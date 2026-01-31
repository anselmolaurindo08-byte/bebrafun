use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// TODO: Replace with actual program ID after first `anchor build`
// Run: anchor keys list — to get the generated ID
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod amm_program {
    use super::*;

    /// Initialize a new AMM pool for a prediction market.
    /// Creates the pool PDA and two token vaults (YES and NO),
    /// then deposits initial reserves from the authority.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        fee_percentage: u16,
        initial_yes_reserve: u64,
        initial_no_reserve: u64,
    ) -> Result<()> {
        require!(fee_percentage <= 1000, AmmError::InvalidFeePercentage);
        require!(initial_yes_reserve > 0, AmmError::InvalidAmount);
        require!(initial_no_reserve > 0, AmmError::InvalidAmount);

        // Initialize pool state
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.yes_mint = ctx.accounts.yes_mint.key();
        pool.no_mint = ctx.accounts.no_mint.key();
        pool.yes_reserve = initial_yes_reserve;
        pool.no_reserve = initial_no_reserve;
        pool.fee_percentage = fee_percentage;
        pool.total_liquidity = integer_sqrt(
            (initial_yes_reserve as u128)
                .checked_mul(initial_no_reserve as u128)
                .ok_or(AmmError::MathOverflow)?,
        );
        pool.bump = ctx.bumps.pool;
        pool.is_active = true;

        // Deposit initial YES tokens into vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority_yes_account.to_account_info(),
                    to: ctx.accounts.yes_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            initial_yes_reserve,
        )?;

        // Deposit initial NO tokens into vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority_no_account.to_account_info(),
                    to: ctx.accounts.no_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            initial_no_reserve,
        )?;

        emit!(PoolInitialized {
            pool: ctx.accounts.pool.key(),
            authority: ctx.accounts.authority.key(),
            yes_mint: ctx.accounts.yes_mint.key(),
            no_mint: ctx.accounts.no_mint.key(),
            yes_reserve: initial_yes_reserve,
            no_reserve: initial_no_reserve,
            fee_percentage,
        });

        Ok(())
    }

    /// Execute a swap using constant product formula (x * y = k).
    ///
    /// Trade types:
    ///   0 = BUY_YES  (user sends NO tokens  → receives YES tokens)
    ///   1 = BUY_NO   (user sends YES tokens → receives NO tokens)
    ///   2 = SELL_YES  (user sends YES tokens → receives NO tokens)
    ///   3 = SELL_NO   (user sends NO tokens  → receives YES tokens)
    pub fn swap(
        ctx: Context<Swap>,
        trade_type: u8,
        input_amount: u64,
        minimum_output: u64,
    ) -> Result<()> {
        require!(input_amount > 0, AmmError::InvalidAmount);
        require!(trade_type <= 3, AmmError::InvalidTradeType);
        require!(ctx.accounts.pool.is_active, AmmError::PoolNotActive);

        // Snapshot pool state for calculation
        let yes_reserve = ctx.accounts.pool.yes_reserve;
        let no_reserve = ctx.accounts.pool.no_reserve;
        let fee_pct = ctx.accounts.pool.fee_percentage;
        let authority_key = ctx.accounts.pool.authority;
        let yes_mint_key = ctx.accounts.pool.yes_mint;
        let no_mint_key = ctx.accounts.pool.no_mint;
        let pool_bump = ctx.accounts.pool.bump;

        // Determine reserves based on trade direction
        let (input_reserve, output_reserve) = match trade_type {
            0 | 3 => (no_reserve, yes_reserve),  // BUY_YES / SELL_NO: NO → YES
            1 | 2 => (yes_reserve, no_reserve),  // BUY_NO / SELL_YES: YES → NO
            _ => return Err(AmmError::InvalidTradeType.into()),
        };

        // Fee calculation (basis points: 50 = 0.5%)
        let fee_amount = input_amount
            .checked_mul(fee_pct as u64)
            .ok_or(AmmError::MathOverflow)?
            / 10000;
        let net_input = input_amount
            .checked_sub(fee_amount)
            .ok_or(AmmError::MathOverflow)?;

        // Constant product: k = x * y
        let k = (input_reserve as u128)
            .checked_mul(output_reserve as u128)
            .ok_or(AmmError::MathOverflow)?;

        let new_input_reserve = (input_reserve as u128)
            .checked_add(net_input as u128)
            .ok_or(AmmError::MathOverflow)?;
        require!(new_input_reserve > 0, AmmError::InsufficientLiquidity);

        // dy = y - (k / (x + dx))
        let new_output_reserve = k
            .checked_div(new_input_reserve)
            .ok_or(AmmError::MathOverflow)?;
        let output_amount_u128 = (output_reserve as u128)
            .checked_sub(new_output_reserve)
            .ok_or(AmmError::InsufficientLiquidity)?;
        let output_amount = u64::try_from(output_amount_u128)
            .map_err(|_| AmmError::MathOverflow)?;

        require!(output_amount > 0, AmmError::InsufficientLiquidity);
        require!(output_amount >= minimum_output, AmmError::SlippageExceeded);

        // --- CPI Token Transfers ---

        // 1) User sends input tokens → pool vault (user signs)
        let (user_send, vault_receive) = match trade_type {
            0 | 3 => (
                ctx.accounts.user_no_account.to_account_info(),
                ctx.accounts.no_vault.to_account_info(),
            ),
            _ => (
                ctx.accounts.user_yes_account.to_account_info(),
                ctx.accounts.yes_vault.to_account_info(),
            ),
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: user_send,
                    to: vault_receive,
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            input_amount,
        )?;

        // 2) Pool vault sends output tokens → user (PDA signs)
        let (vault_send, user_receive) = match trade_type {
            0 | 3 => (
                ctx.accounts.yes_vault.to_account_info(),
                ctx.accounts.user_yes_account.to_account_info(),
            ),
            _ => (
                ctx.accounts.no_vault.to_account_info(),
                ctx.accounts.user_no_account.to_account_info(),
            ),
        };

        let seeds = &[
            b"amm_pool".as_ref(),
            authority_key.as_ref(),
            yes_mint_key.as_ref(),
            no_mint_key.as_ref(),
            &[pool_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: vault_send,
                    to: user_receive,
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            output_amount,
        )?;

        // --- Update pool reserves ---
        let pool = &mut ctx.accounts.pool;
        match trade_type {
            0 | 3 => {
                // NO reserve increases, YES reserve decreases
                pool.no_reserve = no_reserve
                    .checked_add(
                        input_amount
                            .checked_sub(fee_amount)
                            .ok_or(AmmError::MathOverflow)?,
                    )
                    .ok_or(AmmError::MathOverflow)?;
                pool.yes_reserve = yes_reserve
                    .checked_sub(output_amount)
                    .ok_or(AmmError::MathOverflow)?;
            }
            _ => {
                // YES reserve increases, NO reserve decreases
                pool.yes_reserve = yes_reserve
                    .checked_add(
                        input_amount
                            .checked_sub(fee_amount)
                            .ok_or(AmmError::MathOverflow)?,
                    )
                    .ok_or(AmmError::MathOverflow)?;
                pool.no_reserve = no_reserve
                    .checked_sub(output_amount)
                    .ok_or(AmmError::MathOverflow)?;
            }
        }

        pool.total_liquidity = integer_sqrt(
            (pool.yes_reserve as u128)
                .checked_mul(pool.no_reserve as u128)
                .ok_or(AmmError::MathOverflow)?,
        );

        emit!(SwapExecuted {
            pool: ctx.accounts.pool.key(),
            user: ctx.accounts.user.key(),
            trade_type,
            input_amount,
            output_amount,
            fee_amount,
        });

        Ok(())
    }

    /// Close the AMM pool — drains both vaults back to authority.
    /// Only the pool authority can call this.
    pub fn close_pool(ctx: Context<ClosePool>) -> Result<()> {
        require!(ctx.accounts.pool.is_active, AmmError::PoolAlreadyClosed);
        require_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.pool.authority,
            AmmError::Unauthorized
        );

        let authority_key = ctx.accounts.pool.authority;
        let yes_mint_key = ctx.accounts.pool.yes_mint;
        let no_mint_key = ctx.accounts.pool.no_mint;
        let pool_bump = ctx.accounts.pool.bump;

        let seeds = &[
            b"amm_pool".as_ref(),
            authority_key.as_ref(),
            yes_mint_key.as_ref(),
            no_mint_key.as_ref(),
            &[pool_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Drain YES vault
        let yes_balance = ctx.accounts.yes_vault.amount;
        if yes_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.yes_vault.to_account_info(),
                        to: ctx.accounts.authority_yes_account.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                yes_balance,
            )?;
        }

        // Drain NO vault
        let no_balance = ctx.accounts.no_vault.amount;
        if no_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.no_vault.to_account_info(),
                        to: ctx.accounts.authority_no_account.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    signer_seeds,
                ),
                no_balance,
            )?;
        }

        // Mark pool as closed
        let pool = &mut ctx.accounts.pool;
        pool.is_active = false;
        pool.yes_reserve = 0;
        pool.no_reserve = 0;
        pool.total_liquidity = 0;

        emit!(PoolClosed {
            pool: ctx.accounts.pool.key(),
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Integer square root via Newton's method
fn integer_sqrt(n: u128) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x as u64
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

#[account]
pub struct Pool {
    /// The authority who created and controls this pool
    pub authority: Pubkey,
    /// SPL token mint for YES outcome shares
    pub yes_mint: Pubkey,
    /// SPL token mint for NO outcome shares
    pub no_mint: Pubkey,
    /// Current YES token reserve (tracked, mirrors vault balance minus fees)
    pub yes_reserve: u64,
    /// Current NO token reserve
    pub no_reserve: u64,
    /// Trading fee in basis points (50 = 0.5%, max 1000 = 10%)
    pub fee_percentage: u16,
    /// sqrt(yes_reserve * no_reserve)
    pub total_liquidity: u64,
    /// PDA bump seed
    pub bump: u8,
    /// Whether the pool is active for trading
    pub is_active: bool,
}

impl Pool {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // yes_mint
        + 32  // no_mint
        + 8   // yes_reserve
        + 8   // no_reserve
        + 2   // fee_percentage
        + 8   // total_liquidity
        + 1   // bump
        + 1;  // is_active
    // Total: 132
}

// ============================================================================
// CONTEXT STRUCTURES
// ============================================================================

#[derive(Accounts)]
#[instruction(fee_percentage: u16, initial_yes_reserve: u64, initial_no_reserve: u64)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = Pool::LEN,
        seeds = [
            b"amm_pool",
            authority.key().as_ref(),
            yes_mint.key().as_ref(),
            no_mint.key().as_ref(),
        ],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"yes_vault",
            authority.key().as_ref(),
            yes_mint.key().as_ref(),
            no_mint.key().as_ref(),
        ],
        bump,
        token::mint = yes_mint,
        token::authority = pool,
    )]
    pub yes_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"no_vault",
            authority.key().as_ref(),
            yes_mint.key().as_ref(),
            no_mint.key().as_ref(),
        ],
        bump,
        token::mint = no_mint,
        token::authority = pool,
    )]
    pub no_vault: Account<'info, TokenAccount>,

    pub yes_mint: Account<'info, Mint>,
    pub no_mint: Account<'info, Mint>,

    /// Authority's YES token account (source of initial YES reserve)
    #[account(
        mut,
        constraint = authority_yes_account.mint == yes_mint.key(),
    )]
    pub authority_yes_account: Account<'info, TokenAccount>,

    /// Authority's NO token account (source of initial NO reserve)
    #[account(
        mut,
        constraint = authority_no_account.mint == no_mint.key(),
    )]
    pub authority_no_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_type: u8)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [
            b"amm_pool",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [
            b"yes_vault",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump,
    )]
    pub yes_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            b"no_vault",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump,
    )]
    pub no_vault: Account<'info, TokenAccount>,

    /// User's YES token account
    #[account(
        mut,
        constraint = user_yes_account.mint == pool.yes_mint,
    )]
    pub user_yes_account: Account<'info, TokenAccount>,

    /// User's NO token account
    #[account(
        mut,
        constraint = user_no_account.mint == pool.no_mint,
    )]
    pub user_no_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(
        mut,
        seeds = [
            b"amm_pool",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [
            b"yes_vault",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump,
    )]
    pub yes_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            b"no_vault",
            pool.authority.as_ref(),
            pool.yes_mint.as_ref(),
            pool.no_mint.as_ref(),
        ],
        bump,
    )]
    pub no_vault: Account<'info, TokenAccount>,

    /// Authority's YES token account (destination for drained reserves)
    #[account(
        mut,
        constraint = authority_yes_account.mint == pool.yes_mint,
    )]
    pub authority_yes_account: Account<'info, TokenAccount>,

    /// Authority's NO token account (destination for drained reserves)
    #[account(
        mut,
        constraint = authority_no_account.mint == pool.no_mint,
    )]
    pub authority_no_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub fee_percentage: u16,
}

#[event]
pub struct SwapExecuted {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub trade_type: u8,
    pub input_amount: u64,
    pub output_amount: u64,
    pub fee_amount: u64,
}

#[event]
pub struct PoolClosed {
    pub pool: Pubkey,
    pub authority: Pubkey,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum AmmError {
    #[msg("Fee percentage cannot exceed 1000 basis points (10%).")]
    InvalidFeePercentage,

    #[msg("Pool is not active.")]
    PoolNotActive,

    #[msg("Insufficient pool liquidity.")]
    InsufficientLiquidity,

    #[msg("Output below minimum — slippage exceeded.")]
    SlippageExceeded,

    #[msg("Invalid trade type. Must be 0-3.")]
    InvalidTradeType,

    #[msg("Math overflow.")]
    MathOverflow,

    #[msg("Invalid amount. Must be greater than 0.")]
    InvalidAmount,

    #[msg("Unauthorized.")]
    Unauthorized,

    #[msg("Pool is already closed.")]
    PoolAlreadyClosed,
}
