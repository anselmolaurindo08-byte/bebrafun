use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod duels_program {
    use super::*;

    /// Create a new duel
    pub fn create_duel(
        ctx: Context<CreateDuel>,
        duel_id: u64,
        bet_amount: u64,
        currency: u8,
        player_1: Pubkey,
    ) -> Result<()> {
        require!(bet_amount > 0, DuelError::InvalidBetAmount);
        require!(currency <= 1, DuelError::InvalidCurrency);

        let duel = &mut ctx.accounts.duel;
        duel.duel_id = duel_id;
        duel.player_1 = player_1;
        duel.player_2 = Pubkey::default();
        duel.bet_amount = bet_amount;
        duel.currency = currency;
        duel.status = 0; // PENDING
        duel.created_at = Clock::get()?.unix_timestamp;
        duel.bump = ctx.bumps.duel;

        msg!("Duel created: id={}, bet_amount={}, currency={}", duel_id, bet_amount, currency);

        Ok(())
    }

    /// Join an existing duel as player 2
    pub fn join_duel(
        ctx: Context<JoinDuel>,
        player_2: Pubkey,
    ) -> Result<()> {
        let duel = &mut ctx.accounts.duel;

        require!(duel.player_2 == Pubkey::default(), DuelError::DuelAlreadyJoined);
        require!(duel.status == 0, DuelError::InvalidDuelStatus);

        duel.player_2 = player_2;
        duel.status = 1; // MATCHED

        msg!("Player 2 joined duel: {}", duel.duel_id);

        Ok(())
    }

    /// Record player deposit
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        player_id: u8, // 1 or 2
    ) -> Result<()> {
        require!(amount > 0, DuelError::InvalidDepositAmount);
        require!(player_id == 1 || player_id == 2, DuelError::InvalidPlayerId);

        let duel = &mut ctx.accounts.duel;

        // Transfer tokens to duel vault
        transfer_to_vault(
            &ctx.accounts.player_token_account,
            &ctx.accounts.duel_vault,
            &ctx.accounts.token_program,
            &ctx.accounts.player,
            amount,
        )?;

        // Update duel state
        if player_id == 1 {
            duel.player_1_deposited = true;
        } else {
            duel.player_2_deposited = true;
        }

        // If both players have deposited, move to next status
        if duel.player_1_deposited && duel.player_2_deposited {
            duel.status = 3; // CONFIRMING_TRANSACTIONS
        }

        msg!("Player {} deposited {} tokens", player_id, amount);

        Ok(())
    }

    /// Confirm transaction and update confirmations
    pub fn confirm_transaction(
        ctx: Context<ConfirmTransaction>,
        confirmations: u8,
    ) -> Result<()> {
        require!(confirmations > 0, DuelError::InvalidConfirmations);
        require!(confirmations <= 32, DuelError::InvalidConfirmations);

        let duel = &mut ctx.accounts.duel;
        duel.confirmations = confirmations;

        if confirmations >= 6 {
            duel.status = 4; // COUNTDOWN
        }

        msg!("Transaction confirmed: {} confirmations", confirmations);

        Ok(())
    }

    /// Start the duel countdown
    pub fn start_countdown(
        ctx: Context<StartCountdown>,
        entry_price: u64,
    ) -> Result<()> {
        let duel = &mut ctx.accounts.duel;

        require!(duel.status == 4, DuelError::InvalidDuelStatus);
        require!(entry_price > 0, DuelError::InvalidPrice);

        duel.price_at_start = entry_price;
        duel.status = 5; // ACTIVE
        duel.started_at = Clock::get()?.unix_timestamp;

        msg!("Duel started with entry price: {}", entry_price);

        Ok(())
    }

    /// Resolve the duel
    pub fn resolve_duel(
        ctx: Context<ResolveDuel>,
        exit_price: u64,
        winner_id: u8, // 1 or 2
    ) -> Result<()> {
        let duel = &mut ctx.accounts.duel;

        require!(duel.status == 5, DuelError::InvalidDuelStatus);
        require!(exit_price > 0, DuelError::InvalidPrice);
        require!(winner_id == 1 || winner_id == 2, DuelError::InvalidPlayerId);

        duel.price_at_end = exit_price;
        duel.winner_id = winner_id;
        duel.status = 6; // FINISHED
        duel.resolved_at = Clock::get()?.unix_timestamp;

        // Transfer winnings to winner
        let winner_account = if winner_id == 1 {
            &ctx.accounts.player_1_token_account
        } else {
            &ctx.accounts.player_2_token_account
        };

        transfer_from_vault(
            &ctx.accounts.duel_vault,
            winner_account,
            &duel,
            &ctx.accounts.token_program,
            duel.bet_amount * 2, // Winner gets both bets
        )?;

        msg!("Duel resolved: winner={}, exit_price={}", winner_id, exit_price);

        Ok(())
    }

    /// Cancel the duel and refund deposits
    pub fn cancel_duel(
        ctx: Context<CancelDuel>,
    ) -> Result<()> {
        let duel = &mut ctx.accounts.duel;

        require!(
            duel.status == 0 || duel.status == 1 || duel.status == 2,
            DuelError::CannotCancelDuel
        );

        duel.status = 8; // CANCELLED

        // Refund deposits if any
        if duel.player_1_deposited {
            transfer_from_vault(
                &ctx.accounts.duel_vault,
                &ctx.accounts.player_1_token_account,
                &duel,
                &ctx.accounts.token_program,
                duel.bet_amount,
            )?;
        }

        if duel.player_2_deposited {
            transfer_from_vault(
                &ctx.accounts.duel_vault,
                &ctx.accounts.player_2_token_account,
                &duel,
                &ctx.accounts.token_program,
                duel.bet_amount,
            )?;
        }

        msg!("Duel cancelled: {}", duel.duel_id);

        Ok(())
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn transfer_to_vault<'info>(
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    let transfer_instruction = Transfer {
        from: from.to_account_info(),
        to: to.to_account_info(),
        authority: authority.to_account_info(),
    };

    token::transfer(
        CpiContext::new(token_program.to_account_info(), transfer_instruction),
        amount,
    )?;

    Ok(())
}

fn transfer_from_vault<'info>(
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    duel: &Account<'info, DuelAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let seeds = &[b"duel".as_ref(), &duel.duel_id.to_le_bytes(), &[duel.bump]];
    let signer_seeds = &[&seeds[..]];

    let transfer_instruction = Transfer {
        from: from.to_account_info(),
        to: to.to_account_info(),
        authority: duel.to_account_info(),
    };

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        ),
        amount,
    )?;

    Ok(())
}

// ============================================================================
// Account Structures
// ============================================================================

#[derive(Accounts)]
#[instruction(duel_id: u64)]
pub struct CreateDuel<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + DuelAccount::INIT_SPACE,
        seeds = [b"duel", duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub duel: Account<'info, DuelAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    #[account(mut)]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub duel_vault: Account<'info, TokenAccount>,

    pub player: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ConfirmTransaction<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct StartCountdown<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    #[account(mut)]
    pub duel_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_1_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, DuelAccount>,

    #[account(mut)]
    pub duel_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_1_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

// ============================================================================
// Data Structures
// ============================================================================

#[account]
pub struct DuelAccount {
    pub duel_id: u64,
    pub player_1: Pubkey,
    pub player_2: Pubkey,
    pub bet_amount: u64,
    pub currency: u8,
    pub status: u8,
    pub player_1_deposited: bool,
    pub player_2_deposited: bool,
    pub price_at_start: u64,
    pub price_at_end: u64,
    pub winner_id: u8,
    pub confirmations: u8,
    pub created_at: i64,
    pub started_at: i64,
    pub resolved_at: i64,
    pub bump: u8,
}

impl DuelAccount {
    // 8(duel_id) + 32(player_1) + 32(player_2) + 8(bet_amount) + 1(currency) +
    // 1(status) + 1(deposited_1) + 1(deposited_2) + 8(price_start) + 8(price_end) +
    // 1(winner_id) + 1(confirmations) + 8(created_at) + 8(started_at) + 8(resolved_at) + 1(bump)
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 1 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1;
}

// ============================================================================
// Error Handling
// ============================================================================

#[error_code]
pub enum DuelError {
    #[msg("Invalid bet amount")]
    InvalidBetAmount,

    #[msg("Invalid currency")]
    InvalidCurrency,

    #[msg("Duel already joined")]
    DuelAlreadyJoined,

    #[msg("Invalid duel status")]
    InvalidDuelStatus,

    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,

    #[msg("Invalid player ID")]
    InvalidPlayerId,

    #[msg("Invalid confirmations")]
    InvalidConfirmations,

    #[msg("Invalid price")]
    InvalidPrice,

    #[msg("Cannot cancel duel")]
    CannotCancelDuel,
}
