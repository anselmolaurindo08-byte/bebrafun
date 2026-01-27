use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duels_escrow {
    use super::*;

    /// Initialize a new escrow account for a duel
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        duel_id: u64,
        total_amount: u64,
        resolver: Pubkey,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.duel_id = duel_id;
        escrow.total_amount = total_amount;
        escrow.player_1 = ctx.accounts.player_1.key();
        escrow.player_2 = ctx.accounts.player_2.key();
        escrow.player_1_amount = 0;
        escrow.player_2_amount = 0;
        escrow.resolver = resolver;
        escrow.status = EscrowStatus::Active;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.resolved_at = None;
        escrow.winner = None;

        emit!(EscrowInitialized {
            duel_id,
            player_1: ctx.accounts.player_1.key(),
            player_2: ctx.accounts.player_2.key(),
            total_amount,
        });

        Ok(())
    }

    /// Deposit tokens from a player to escrow
    pub fn deposit_to_escrow(
        ctx: Context<DepositToEscrow>,
        amount: u64,
        player_number: u8,
    ) -> Result<()> {
        require!(player_number == 1 || player_number == 2, CustomError::InvalidPlayerNumber);
        require!(amount > 0, CustomError::InvalidAmount);

        let escrow = &mut ctx.accounts.escrow_account;
        require_eq!(escrow.status, EscrowStatus::Active, CustomError::EscrowNotActive);

        // Verify player is correct
        if player_number == 1 {
            require_eq!(ctx.accounts.player.key(), escrow.player_1, CustomError::UnauthorizedPlayer);
            escrow.player_1_amount = escrow.player_1_amount.checked_add(amount).unwrap();
        } else {
            require_eq!(ctx.accounts.player.key(), escrow.player_2, CustomError::UnauthorizedPlayer);
            escrow.player_2_amount = escrow.player_2_amount.checked_add(amount).unwrap();
        }

        // Transfer tokens from player to escrow
        let transfer_instruction = Transfer {
            from: ctx.accounts.player_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;

        emit!(TokensDeposited {
            duel_id: escrow.duel_id,
            player: ctx.accounts.player.key(),
            player_number,
            amount,
        });

        Ok(())
    }

    /// Release tokens to the winner
    pub fn release_to_winner(
        ctx: Context<ReleaseToWinner>,
        winner_number: u8,
        winner_amount: u64,
    ) -> Result<()> {
        require!(winner_number == 1 || winner_number == 2, CustomError::InvalidPlayerNumber);

        let escrow = &mut ctx.accounts.escrow_account;
        require_eq!(escrow.status, EscrowStatus::Active, CustomError::EscrowNotActive);

        // Verify authority (only resolver can call this)
        require_eq!(ctx.accounts.authority.key(), escrow.resolver, CustomError::UnauthorizedResolver);

        // Determine winner
        let winner_key = if winner_number == 1 {
            escrow.player_1
        } else {
            escrow.player_2
        };

        require_eq!(ctx.accounts.winner.key(), winner_key, CustomError::InvalidWinner);

        // Transfer winner amount to winner
        let transfer_instruction = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };

        let seeds = &[
            b"escrow".as_ref(),
            escrow.duel_id.to_le_bytes().as_ref(),
            &[ctx.bumps.escrow_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer_seeds,
            ),
            winner_amount,
        )?;

        // Update escrow status
        escrow.status = EscrowStatus::Resolved;
        escrow.resolved_at = Some(Clock::get()?.unix_timestamp);
        escrow.winner = Some(winner_key);

        emit!(TokensReleased {
            duel_id: escrow.duel_id,
            winner: winner_key,
            amount: winner_amount,
        });

        Ok(())
    }

    /// Transfer loser's tokens to winner
    pub fn transfer_loser_tokens(
        ctx: Context<TransferLoserTokens>,
        winner_number: u8,
    ) -> Result<()> {
        require!(winner_number == 1 || winner_number == 2, CustomError::InvalidPlayerNumber);

        let escrow = &mut ctx.accounts.escrow_account;
        require_eq!(escrow.status, EscrowStatus::Active, CustomError::EscrowNotActive);

        // Verify authority
        require_eq!(ctx.accounts.authority.key(), escrow.resolver, CustomError::UnauthorizedResolver);

        let (winner_key, loser_amount) = if winner_number == 1 {
            (escrow.player_1, escrow.player_2_amount)
        } else {
            (escrow.player_2, escrow.player_1_amount)
        };

        require_eq!(ctx.accounts.winner.key(), winner_key, CustomError::InvalidWinner);
        require!(loser_amount > 0, CustomError::NoTokensToTransfer);

        // Transfer loser tokens to winner
        let transfer_instruction = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };

        let seeds = &[
            b"escrow".as_ref(),
            escrow.duel_id.to_le_bytes().as_ref(),
            &[ctx.bumps.escrow_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer_seeds,
            ),
            loser_amount,
        )?;

        // Update escrow status
        escrow.status = EscrowStatus::Resolved;
        escrow.resolved_at = Some(Clock::get()?.unix_timestamp);
        escrow.winner = Some(winner_key);

        emit!(LoserTokensTransferred {
            duel_id: escrow.duel_id,
            winner: winner_key,
            loser_amount,
        });

        Ok(())
    }

    /// Withdraw unclaimed tokens (emergency function)
    pub fn withdraw_unclaimed(
        ctx: Context<WithdrawUnclaimed>,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;

        // Only allow withdrawal if resolved
        require_eq!(escrow.status, EscrowStatus::Resolved, CustomError::EscrowNotResolved);

        // Verify authority
        require_eq!(ctx.accounts.authority.key(), escrow.resolver, CustomError::UnauthorizedResolver);

        // Get remaining balance
        let remaining_balance = ctx.accounts.escrow_token_account.amount;
        require!(remaining_balance > 0, CustomError::NoTokensToWithdraw);

        // Transfer remaining tokens back to authority
        let transfer_instruction = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };

        let seeds = &[
            b"escrow".as_ref(),
            escrow.duel_id.to_le_bytes().as_ref(),
            &[ctx.bumps.escrow_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer_seeds,
            ),
            remaining_balance,
        )?;

        emit!(UnclaimedTokensWithdrawn {
            duel_id: escrow.duel_id,
            amount: remaining_balance,
        });

        Ok(())
    }

    /// Cancel escrow and return tokens to players (only if not resolved)
    pub fn cancel_escrow(
        ctx: Context<CancelEscrow>,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        require_eq!(escrow.status, EscrowStatus::Active, CustomError::EscrowNotActive);
        require_eq!(ctx.accounts.authority.key(), escrow.resolver, CustomError::UnauthorizedResolver);

        let seeds = &[
            b"escrow".as_ref(),
            escrow.duel_id.to_le_bytes().as_ref(),
            &[ctx.bumps.escrow_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        // Return player 1 tokens
        if escrow.player_1_amount > 0 {
            let transfer_instruction = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.player_1_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            };

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    signer_seeds,
                ),
                escrow.player_1_amount,
            )?;
        }

        // Return player 2 tokens
        if escrow.player_2_amount > 0 {
            let transfer_instruction = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.player_2_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            };

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    signer_seeds,
                ),
                escrow.player_2_amount,
            )?;
        }

        escrow.status = EscrowStatus::Cancelled;

        emit!(EscrowCancelled {
            duel_id: escrow.duel_id,
        });

        Ok(())
    }
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

#[account]
pub struct EscrowAccount {
    pub duel_id: u64,
    pub total_amount: u64,
    pub player_1: Pubkey,
    pub player_2: Pubkey,
    pub player_1_amount: u64,
    pub player_2_amount: u64,
    pub resolver: Pubkey,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub winner: Option<Pubkey>,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + // discriminator
        8 + // duel_id
        8 + // total_amount
        32 + // player_1
        32 + // player_2
        8 + // player_1_amount
        8 + // player_2_amount
        32 + // resolver
        1 + // status
        8 + // created_at
        1 + 8 + // resolved_at (Option<i64>)
        1 + 32; // winner (Option<Pubkey>)
}

#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum EscrowStatus {
    Active,
    Resolved,
    Cancelled,
}

// ============================================================================
// CONTEXT STRUCTURES
// ============================================================================

#[derive(Accounts)]
#[instruction(duel_id: u64)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = authority,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Player 1 address
    pub player_1: AccountInfo<'info>,

    /// CHECK: Player 2 address
    pub player_2: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToEscrow<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub player: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseToWinner<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"escrow", escrow_account.duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    /// CHECK: Winner address
    pub winner: AccountInfo<'info>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferLoserTokens<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"escrow", escrow_account.duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    /// CHECK: Winner address
    pub winner: AccountInfo<'info>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawUnclaimed<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"escrow", escrow_account.duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_1_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"escrow", escrow_account.duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct EscrowInitialized {
    pub duel_id: u64,
    pub player_1: Pubkey,
    pub player_2: Pubkey,
    pub total_amount: u64,
}

#[event]
pub struct TokensDeposited {
    pub duel_id: u64,
    pub player: Pubkey,
    pub player_number: u8,
    pub amount: u64,
}

#[event]
pub struct TokensReleased {
    pub duel_id: u64,
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct LoserTokensTransferred {
    pub duel_id: u64,
    pub winner: Pubkey,
    pub loser_amount: u64,
}

#[event]
pub struct UnclaimedTokensWithdrawn {
    pub duel_id: u64,
    pub amount: u64,
}

#[event]
pub struct EscrowCancelled {
    pub duel_id: u64,
}

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

#[error_code]
pub enum CustomError {
    #[msg("Invalid player number. Must be 1 or 2.")]
    InvalidPlayerNumber,

    #[msg("Invalid amount. Must be greater than 0.")]
    InvalidAmount,

    #[msg("Escrow is not active.")]
    EscrowNotActive,

    #[msg("Unauthorized player.")]
    UnauthorizedPlayer,

    #[msg("Unauthorized resolver.")]
    UnauthorizedResolver,

    #[msg("Invalid winner.")]
    InvalidWinner,

    #[msg("No tokens to transfer.")]
    NoTokensToTransfer,

    #[msg("Escrow not resolved.")]
    EscrowNotResolved,

    #[msg("No tokens to withdraw.")]
    NoTokensToWithdraw,
}
