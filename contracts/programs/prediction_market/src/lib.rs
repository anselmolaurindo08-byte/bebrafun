use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod prediction_market {
    use super::*;

    // =================================================================
    // DUELS INSTRUCTIONS
    // =================================================================

    pub fn initialize_duel(
        ctx: Context<InitializeDuel>,
        duel_id: u64,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.duel_id = duel_id;
        escrow.player_one = ctx.accounts.player_one.key();
        escrow.amount = amount;
        escrow.state = DuelState::WaitingForOpponent;
        escrow.bump = *ctx.bumps.get("escrow_account").unwrap();

        // Transfer Player 1's stake to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_one_token_account.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.player_one.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.state == DuelState::WaitingForOpponent, DuelError::InvalidState);

        // Transfer Player 2's stake to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_two_token_account.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.player_two.to_account_info(),
                },
            ),
            escrow.amount,
        )?;

        escrow.player_two = ctx.accounts.player_two.key();
        escrow.state = DuelState::Active;
        Ok(())
    }

    pub fn resolve_duel(
        ctx: Context<ResolveDuel>,
        winner: Pubkey
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.state == DuelState::Active, DuelError::InvalidState);

        // Verify winner is a participant
        require!(winner == escrow.player_one || winner == escrow.player_two, DuelError::InvalidWinner);

        // Calculate total amount (2x stake)
        let total_amount = ctx.accounts.escrow_vault.amount;

        // PDA Signer seeds
        let seeds = &[
            b"duel_escrow",
            &escrow.duel_id.to_le_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer total vault balance to winner
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.winner_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_account.to_account_info(),
                },
                signer,
            ),
            total_amount,
        )?;

        escrow.state = DuelState::Resolved;
        Ok(())
    }

    pub fn cancel_duel(ctx: Context<CancelDuel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.state == DuelState::WaitingForOpponent, DuelError::InvalidState);
        require!(ctx.accounts.player_one.key() == escrow.player_one, DuelError::Unauthorized);

        let amount = ctx.accounts.escrow_vault.amount;

        let seeds = &[
            b"duel_escrow",
            &escrow.duel_id.to_le_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Refund Player 1
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.player_one_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_account.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        escrow.state = DuelState::Cancelled;
        Ok(())
    }

    // =================================================================
    // AMM MARKET INSTRUCTIONS
    // =================================================================

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        market_id: u64,
        fee_basis_points: u16,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.market_id = market_id;
        pool.authority = ctx.accounts.authority.key();
        pool.yes_reserve = 0;
        pool.no_reserve = 0;
        pool.fee_basis_points = fee_basis_points;
        pool.bump = *ctx.bumps.get("pool").unwrap();
        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        yes_amount: u64,
        no_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // Transfer YES tokens to pool vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_yes_account.to_account_info(),
                    to: ctx.accounts.pool_yes_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            yes_amount,
        )?;

        // Transfer NO tokens to pool vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_no_account.to_account_info(),
                    to: ctx.accounts.pool_no_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            no_amount,
        )?;

        pool.yes_reserve += yes_amount;
        pool.no_reserve += no_amount;

        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        is_buy_yes: bool, // true = swap NO for YES (buy YES), false = swap YES for NO (buy NO)
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        let (input_reserve, output_reserve) = if is_buy_yes {
            (pool.no_reserve, pool.yes_reserve)
        } else {
            (pool.yes_reserve, pool.no_reserve)
        };

        // Calculate fee
        let fee_amount = (amount_in as u128 * pool.fee_basis_points as u128 / 10000) as u64;
        let amount_in_after_fee = amount_in - fee_amount;

        // Constant Product Formula: x * y = k
        // (x + dx) * (y - dy) = x * y
        // dy = y - (x * y) / (x + dx)
        let numerator = (amount_in_after_fee as u128) * (output_reserve as u128);
        let denominator = (input_reserve as u128) + (amount_in_after_fee as u128);
        let amount_out = (numerator / denominator) as u64;

        require!(amount_out >= min_amount_out, AMMError::SlippageExceeded);

        // Update reserves
        if is_buy_yes {
            pool.no_reserve += amount_in;
            pool.yes_reserve -= amount_out;
        } else {
            pool.yes_reserve += amount_in;
            pool.no_reserve -= amount_out;
        }

        // Execute transfers
        // 1. Transfer Input from User to Pool
        let (user_input_account, pool_input_vault) = if is_buy_yes {
            (&ctx.accounts.user_no_account, &ctx.accounts.pool_no_vault)
        } else {
            (&ctx.accounts.user_yes_account, &ctx.accounts.pool_yes_vault)
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: user_input_account.to_account_info(),
                    to: pool_input_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        // 2. Transfer Output from Pool to User
        let (pool_output_vault, user_output_account) = if is_buy_yes {
            (&ctx.accounts.pool_yes_vault, &ctx.accounts.user_yes_account)
        } else {
            (&ctx.accounts.pool_no_vault, &ctx.accounts.user_no_account)
        };

        let seeds = &[
            b"market_pool",
            &pool.market_id.to_le_bytes(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: pool_output_vault.to_account_info(),
                    to: user_output_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer,
            ),
            amount_out,
        )?;

        Ok(())
    }
}

// =================================================================
// DUELS CONTEXTS
// =================================================================

#[derive(Accounts)]
#[instruction(duel_id: u64)]
pub struct InitializeDuel<'info> {
    #[account(
        init,
        seeds = [b"duel_escrow", duel_id.to_le_bytes().as_ref()],
        bump,
        payer = player_one,
        space = 8 + 8 + 32 + 32 + 8 + 1 + 1
    )]
    pub escrow_account: Account<'info, DuelEscrow>,

    #[account(mut)]
    pub player_one: Signer<'info>,

    #[account(mut)]
    pub player_one_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = player_one,
        seeds = [b"duel_vault", duel_id.to_le_bytes().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = escrow_account
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, token::Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, DuelEscrow>,

    #[account(mut)]
    pub player_two: Signer<'info>,

    #[account(mut)]
    pub player_two_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveDuel<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, DuelEscrow>,

    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>, // Server Wallet

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelDuel<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, DuelEscrow>,

    #[account(mut)]
    pub player_one: Signer<'info>,

    #[account(mut)]
    pub player_one_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct DuelEscrow {
    pub duel_id: u64,
    pub player_one: Pubkey,
    pub player_two: Pubkey,
    pub amount: u64,
    pub bump: u8,
    pub state: DuelState,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DuelState {
    WaitingForOpponent,
    Active,
    Resolved,
    Cancelled,
}

#[error_code]
pub enum DuelError {
    #[msg("Invalid duel state")]
    InvalidState,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid winner")]
    InvalidWinner,
}

// =================================================================
// AMM CONTEXTS
// =================================================================

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct InitializePool<'info> {
    #[account(
        init,
        seeds = [b"market_pool", market_id.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = 8 + 8 + 32 + 8 + 8 + 2 + 1
    )]
    pub pool: Account<'info, MarketPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        seeds = [b"pool_yes_vault", market_id.to_le_bytes().as_ref()],
        bump,
        token::mint = yes_mint,
        token::authority = pool
    )]
    pub pool_yes_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        seeds = [b"pool_no_vault", market_id.to_le_bytes().as_ref()],
        bump,
        token::mint = no_mint,
        token::authority = pool
    )]
    pub pool_no_vault: Account<'info, TokenAccount>,

    pub yes_mint: Account<'info, token::Mint>,
    pub no_mint: Account<'info, token::Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_yes_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_no_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_yes_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_no_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_yes_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_no_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_yes_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_no_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct MarketPool {
    pub market_id: u64,
    pub authority: Pubkey,
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub fee_basis_points: u16,
    pub bump: u8,
}

#[error_code]
pub enum AMMError {
    #[msg("Slippage exceeded")]
    SlippageExceeded,
}
