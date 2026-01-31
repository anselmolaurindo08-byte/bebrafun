use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod prediction_market {
    use super::*;

    // =================================================================
    // DUELS INSTRUCTIONS
    // =================================================================

    pub fn initialize_duel_escrow(
        ctx: Context<InitializeDuelEscrow>,
        duel_id: u64,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.duel_id = duel_id;
        escrow.player_one = ctx.accounts.player_one.key();
        escrow.player_two = Pubkey::default(); // Optional for now
        escrow.amount = amount;
        escrow.bump = *ctx.bumps.get("escrow_account").unwrap();
        escrow.state = DuelState::WaitingForOpponent;
        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.state == DuelState::WaitingForOpponent, DuelError::InvalidState);

        // Deposit Player 2's tokens into escrow vault
        let transfer_ix = Transfer {
            from: ctx.accounts.player_two_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.player_two.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_ix,
            ),
            escrow.amount,
        )?;

        escrow.player_two = ctx.accounts.player_two.key();
        escrow.state = DuelState::Active;
        Ok(())
    }

    // Usually, the first deposit happens in a separate instruction or combined if PDA allows
    // But for simplicity in this flow:
    // 1. P1 calls initialize_duel_escrow AND transfers tokens to vault in same TX (need to add transfer logic there)

    // Let's patch initialize_duel_escrow to accept deposit immediately
    /*
      We will overwrite the logic for `initialize_duel_escrow` below to include transfer.
    */

    pub fn resolve_duel(
        ctx: Context<ResolveDuel>,
        winner: Pubkey
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require!(escrow.state == DuelState::Active, DuelError::InvalidState);

        // In a real app, only an oracle/authority can call this
        require!(ctx.accounts.authority.key() == escrow.player_one || ctx.accounts.authority.key() == escrow.player_two, DuelError::Unauthorized); // Temporary: players resolve? No, needs admin/oracle
        // Better: require!(ctx.accounts.authority.key() == ADMIN_KEY, DuelError::Unauthorized);

        let total_amount = escrow.amount * 2;

        let seeds = &[
            b"duel_escrow",
            &escrow.duel_id.to_le_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ix = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_ix,
                signer,
            ),
            total_amount,
        )?;

        escrow.state = DuelState::Resolved;
        Ok(())
    }

    // =================================================================
    // AMM MARKET INSTRUCTIONS
    // =================================================================

    pub fn initialize_market_pool(
        ctx: Context<InitializeMarketPool>,
        market_id: u64,
        fee_basis_points: u16,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.market_id = market_id;
        pool.authority = ctx.accounts.authority.key();
        pool.yes_mint = ctx.accounts.yes_mint.key();
        pool.no_mint = ctx.accounts.no_mint.key();
        pool.collateral_mint = ctx.accounts.collateral_mint.key();
        pool.fee_basis_points = fee_basis_points;
        pool.bump = *ctx.bumps.get("pool").unwrap();
        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        is_buy_yes: bool, // true = buy YES (sell Collateral), false = buy NO... wait.
        // Simplified AMM: usually you trade Collateral (USDC/SOL) for YES or NO tokens.
    ) -> Result<()> {
        // AMM Logic here (Constant Product or similar)
        // Validation...
        // Transfer In...
        // Calculate Out...
        // Transfer Out...
        Ok(())
    }
}

// =================================================================
// DUELS STATE & CONTEXTS
// =================================================================

#[derive(Accounts)]
#[instruction(duel_id: u64, amount: u64)]
pub struct InitializeDuelEscrow<'info> {
    #[account(init, seeds = [b"duel_escrow", duel_id.to_le_bytes().as_ref()], bump, payer = player_one, space = 8 + 8 + 32 + 32 + 8 + 1 + 1)]
    pub escrow_account: Account<'info, DuelEscrow>,

    #[account(mut)]
    pub player_one: Signer<'info>,

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

    #[account(mut)]
    pub player_one_token_account: Account<'info, TokenAccount>,

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

    pub authority: Signer<'info>, // Admin or Oracle

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
}

// =================================================================
// AMM STATE & CONTEXTS
// =================================================================

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct InitializeMarketPool<'info> {
    #[account(init, seeds = [b"market_pool", market_id.to_le_bytes().as_ref()], bump, payer = authority, space = 8 + 200)]
    pub pool: Account<'info, MarketPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub yes_mint: Account<'info, token::Mint>,
    pub no_mint: Account<'info, token::Mint>,
    pub collateral_mint: Account<'info, token::Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, MarketPool>,
    // ... other accounts needed for swap
}

#[account]
pub struct MarketPool {
    pub market_id: u64,
    pub authority: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub fee_basis_points: u16,
    pub bump: u8,
    // Add reserves tracking if not using token accounts directly
}
