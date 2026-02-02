use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod prediction_market {
    use super::*;

    // ========================================================================
    // DUEL INSTRUCTIONS
    // ========================================================================

    /// Initialize a new 1v1 duel with player 1's deposit
    pub fn initialize_duel(
        ctx: Context<InitializeDuel>,
        duel_id: u64,
        amount: u64,
        predicted_outcome: u8, // 0 = DOWN, 1 = UP
    ) -> Result<()> {
        require!(amount > 0, PredictionMarketError::InvalidAmount);
        require!(predicted_outcome <= 1, PredictionMarketError::InvalidOutcome);

        let duel = &mut ctx.accounts.duel;
        duel.duel_id = duel_id;
        duel.player_1 = ctx.accounts.player_1.key();
        duel.player_2 = None;
        duel.amount = amount;
        duel.token_mint = ctx.accounts.token_mint.key();
        duel.player_1_prediction = predicted_outcome;
        duel.player_2_prediction = None;
        duel.entry_price = 0;
        duel.exit_price = 0;
        duel.winner = None;
        duel.status = DuelStatus::WaitingForPlayer2;
        duel.created_at = Clock::get()?.unix_timestamp;
        duel.started_at = None;
        duel.resolved_at = None;
        duel.bump = ctx.bumps.duel;

        // Transfer player 1's deposit to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_1_token_account.to_account_info(),
                    to: ctx.accounts.duel_vault.to_account_info(),
                    authority: ctx.accounts.player_1.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(DuelCreated {
            duel_id,
            player_1: ctx.accounts.player_1.key(),
            amount,
            token_mint: ctx.accounts.token_mint.key(),
            prediction: predicted_outcome,
        });

        Ok(())
    }

    /// Player 2 joins the duel with their deposit
    pub fn join_duel(
        ctx: Context<JoinDuel>,
        predicted_outcome: u8,
    ) -> Result<()> {
        require!(predicted_outcome <= 1, PredictionMarketError::InvalidOutcome);
        
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.status == DuelStatus::WaitingForPlayer2,
            PredictionMarketError::InvalidDuelStatus
        );
        require!(duel.player_2.is_none(), PredictionMarketError::DuelAlreadyJoined);

        duel.player_2 = Some(ctx.accounts.player_2.key());
        duel.player_2_prediction = Some(predicted_outcome);
        duel.status = DuelStatus::Countdown;

        // Transfer player 2's deposit to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_2_token_account.to_account_info(),
                    to: ctx.accounts.duel_vault.to_account_info(),
                    authority: ctx.accounts.player_2.to_account_info(),
                },
            ),
            duel.amount,
        )?;

        emit!(DuelJoined {
            duel_id: duel.duel_id,
            player_2: ctx.accounts.player_2.key(),
            prediction: predicted_outcome,
        });

        Ok(())
    }

    /// Start the duel after countdown (called by server)
    pub fn start_duel(
        ctx: Context<StartDuel>,
        entry_price: u64,
    ) -> Result<()> {
        require!(entry_price > 0, PredictionMarketError::InvalidPrice);
        
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.status == DuelStatus::Countdown,
            PredictionMarketError::InvalidDuelStatus
        );

        duel.entry_price = entry_price;
        duel.status = DuelStatus::Active;
        duel.started_at = Some(Clock::get()?.unix_timestamp);

        emit!(DuelStarted {
            duel_id: duel.duel_id,
            entry_price,
            started_at: duel.started_at.unwrap(),
        });

        Ok(())
    }

    /// Resolve the duel and pay out winner
    pub fn resolve_duel(
        ctx: Context<ResolveDuel>,
        exit_price: u64,
    ) -> Result<()> {
        require!(exit_price > 0, PredictionMarketError::InvalidPrice);
        
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.status == DuelStatus::Active,
            PredictionMarketError::InvalidDuelStatus
        );

        duel.exit_price = exit_price;

        // Determine winner based on price movement and predictions
        let price_went_up = exit_price > duel.entry_price;
        let player_1_correct = (duel.player_1_prediction == 1 && price_went_up) ||
                               (duel.player_1_prediction == 0 && !price_went_up);
        
        let winner_pubkey = if player_1_correct {
            duel.player_1
        } else {
            duel.player_2.unwrap()
        };

        duel.winner = Some(winner_pubkey);
        duel.status = DuelStatus::Resolved;
        duel.resolved_at = Some(Clock::get()?.unix_timestamp);

        // Transfer winnings to winner (both deposits)
        let total_payout = duel.amount.checked_mul(2).unwrap();
        
        let seeds = &[
            b"duel_vault",
            duel.duel_id.to_le_bytes().as_ref(),
            duel.token_mint.as_ref(),
            &[duel.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let winner_account = if player_1_correct {
            &ctx.accounts.player_1_token_account
        } else {
            &ctx.accounts.player_2_token_account
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.duel_vault.to_account_info(),
                    to: winner_account.to_account_info(),
                    authority: ctx.accounts.duel_vault.to_account_info(),
                },
                signer_seeds,
            ),
            total_payout,
        )?;

        emit!(DuelResolved {
            duel_id: duel.duel_id,
            winner: winner_pubkey,
            exit_price,
            payout: total_payout,
        });

        Ok(())
    }

    // ========================================================================
    // AMM POOL INSTRUCTIONS
    // ========================================================================

    /// Create a new AMM prediction market pool
    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_id: u64,
        question: String,
        resolution_time: i64,
        initial_liquidity: u64,
    ) -> Result<()> {
        require!(initial_liquidity > 0, PredictionMarketError::InvalidAmount);
        require!(question.len() <= 200, PredictionMarketError::QuestionTooLong);
        require!(
            resolution_time > Clock::get()?.unix_timestamp,
            PredictionMarketError::InvalidResolutionTime
        );

        let pool = &mut ctx.accounts.pool;
        pool.pool_id = pool_id;
        pool.authority = ctx.accounts.authority.key();
        pool.token_mint = ctx.accounts.token_mint.key();
        pool.question = question.clone();
        pool.resolution_time = resolution_time;
        pool.yes_reserve = initial_liquidity / 2;
        pool.no_reserve = initial_liquidity / 2;
        pool.total_liquidity = initial_liquidity;
        pool.outcome = None;
        pool.status = PoolStatus::Active;
        pool.created_at = Clock::get()?.unix_timestamp;
        pool.bump = ctx.bumps.pool;

        // Transfer initial liquidity to pool vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority_token_account.to_account_info(),
                    to: ctx.accounts.pool_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            initial_liquidity,
        )?;

        emit!(PoolCreated {
            pool_id,
            authority: ctx.accounts.authority.key(),
            token_mint: ctx.accounts.token_mint.key(),
            question,
            resolution_time,
            initial_liquidity,
        });

        Ok(())
    }

    /// Buy YES or NO outcome tokens
    pub fn buy_outcome(
        ctx: Context<BuyOutcome>,
        outcome: Outcome,
        amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        require!(amount > 0, PredictionMarketError::InvalidAmount);
        
        let pool = &mut ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Active,
            PredictionMarketError::PoolNotActive
        );
        require!(
            Clock::get()?.unix_timestamp < pool.resolution_time,
            PredictionMarketError::PoolExpired
        );

        // Calculate tokens out using constant product formula
        let (input_reserve, output_reserve) = match outcome {
            Outcome::Yes => (pool.no_reserve, pool.yes_reserve),
            Outcome::No => (pool.yes_reserve, pool.no_reserve),
        };

        let k = (input_reserve as u128)
            .checked_mul(output_reserve as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_input_reserve = (input_reserve as u128)
            .checked_add(amount as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_output_reserve = k
            .checked_div(new_input_reserve)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let tokens_out = (output_reserve as u128)
            .checked_sub(new_output_reserve)
            .ok_or(PredictionMarketError::InsufficientLiquidity)?;

        let tokens_out_u64 = u64::try_from(tokens_out)
            .map_err(|_| PredictionMarketError::MathOverflow)?;

        require!(
            tokens_out_u64 >= min_tokens_out,
            PredictionMarketError::SlippageExceeded
        );

        // Transfer payment to pool
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.pool_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update reserves
        match outcome {
            Outcome::Yes => {
                pool.no_reserve += amount;
                pool.yes_reserve -= tokens_out_u64;
            }
            Outcome::No => {
                pool.yes_reserve += amount;
                pool.no_reserve -= tokens_out_u64;
            }
        }

        // Update or create user position
        let position = &mut ctx.accounts.user_position;
        if position.pool_id == 0 {
            // Initialize new position
            position.user = ctx.accounts.user.key();
            position.pool_id = pool.pool_id;
            position.yes_tokens = 0;
            position.no_tokens = 0;
        }

        match outcome {
            Outcome::Yes => position.yes_tokens += tokens_out_u64,
            Outcome::No => position.no_tokens += tokens_out_u64,
        }

        emit!(OutcomePurchased {
            pool_id: pool.pool_id,
            user: ctx.accounts.user.key(),
            outcome,
            amount_paid: amount,
            tokens_received: tokens_out_u64,
        });

        Ok(())
    }

    /// Resolve the pool and set outcome
    pub fn resolve_pool(
        ctx: Context<ResolvePool>,
        outcome: Outcome,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Active,
            PredictionMarketError::PoolNotActive
        );
        require!(
            Clock::get()?.unix_timestamp >= pool.resolution_time,
            PredictionMarketError::PoolNotExpired
        );

        pool.outcome = Some(outcome);
        pool.status = PoolStatus::Resolved;

        emit!(PoolResolved {
            pool_id: pool.pool_id,
            outcome,
        });

        Ok(())
    }

    /// Claim winnings from resolved pool
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Resolved,
            PredictionMarketError::PoolNotResolved
        );

        let position = &mut ctx.accounts.user_position;
        let winning_tokens = match pool.outcome.unwrap() {
            Outcome::Yes => position.yes_tokens,
            Outcome::No => position.no_tokens,
        };

        require!(winning_tokens > 0, PredictionMarketError::NoWinnings);

        // Transfer winnings (1:1 payout for winning tokens)
        let seeds = &[
            b"pool_vault",
            pool.pool_id.to_le_bytes().as_ref(),
            pool.token_mint.as_ref(),
            &[pool.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.pool_vault.to_account_info(),
                },
                signer_seeds,
            ),
            winning_tokens,
        )?;

        // Reset position
        position.yes_tokens = 0;
        position.no_tokens = 0;

        emit!(WinningsClaimed {
            pool_id: pool.pool_id,
            user: ctx.accounts.user.key(),
            amount: winning_tokens,
        });

        Ok(())
    }
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

#[account]
pub struct Duel {
    pub duel_id: u64,
    pub player_1: Pubkey,
    pub player_2: Option<Pubkey>,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub player_1_prediction: u8,
    pub player_2_prediction: Option<u8>,
    pub entry_price: u64,
    pub exit_price: u64,
    pub winner: Option<Pubkey>,
    pub status: DuelStatus,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

#[account]
pub struct Pool {
    pub pool_id: u64,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub question: String,
    pub resolution_time: i64,
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub total_liquidity: u64,
    pub outcome: Option<Outcome>,
    pub status: PoolStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct UserPosition {
    pub user: Pubkey,
    pub pool_id: u64,
    pub yes_tokens: u64,
    pub no_tokens: u64,
}

// ============================================================================
// ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DuelStatus {
    WaitingForPlayer2,
    Countdown,
    Active,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PoolStatus {
    Active,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Yes,
    No,
}

// ============================================================================
// CONTEXT STRUCTURES
// ============================================================================

#[derive(Accounts)]
#[instruction(duel_id: u64)]
pub struct InitializeDuel<'info> {
    #[account(
        init,
        payer = player_1,
        space = 8 + 300,
        seeds = [b"duel", duel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub duel: Account<'info, Duel>,

    #[account(
        init,
        payer = player_1,
        seeds = [b"duel_vault", duel_id.to_le_bytes().as_ref(), token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = duel_vault,
    )]
    pub duel_vault: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub player_1_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_1: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, Duel>,

    #[account(mut)]
    pub duel_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StartDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, Duel>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, Duel>,

    #[account(mut)]
    pub duel_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_1_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player_2_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 500,
        seeds = [b"pool", pool_id.to_le_bytes().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = authority,
        seeds = [b"pool_vault", pool_id.to_le_bytes().as_ref(), token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = pool_vault,
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyOutcome<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 80,
        seeds = [b"position", pool.pool_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolvePool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct DuelCreated {
    pub duel_id: u64,
    pub player_1: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub prediction: u8,
}

#[event]
pub struct DuelJoined {
    pub duel_id: u64,
    pub player_2: Pubkey,
    pub prediction: u8,
}

#[event]
pub struct DuelStarted {
    pub duel_id: u64,
    pub entry_price: u64,
    pub started_at: i64,
}

#[event]
pub struct DuelResolved {
    pub duel_id: u64,
    pub winner: Pubkey,
    pub exit_price: u64,
    pub payout: u64,
}

#[event]
pub struct PoolCreated {
    pub pool_id: u64,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub question: String,
    pub resolution_time: i64,
    pub initial_liquidity: u64,
}

#[event]
pub struct OutcomePurchased {
    pub pool_id: u64,
    pub user: Pubkey,
    pub outcome: Outcome,
    pub amount_paid: u64,
    pub tokens_received: u64,
}

#[event]
pub struct PoolResolved {
    pub pool_id: u64,
    pub outcome: Outcome,
}

#[event]
pub struct WinningsClaimed {
    pub pool_id: u64,
    pub user: Pubkey,
    pub amount: u64,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum PredictionMarketError {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid outcome")]
    InvalidOutcome,

    #[msg("Invalid duel status")]
    InvalidDuelStatus,

    #[msg("Duel already joined")]
    DuelAlreadyJoined,

    #[msg("Invalid price")]
    InvalidPrice,

    #[msg("Question too long")]
    QuestionTooLong,

    #[msg("Invalid resolution time")]
    InvalidResolutionTime,

    #[msg("Pool not active")]
    PoolNotActive,

    #[msg("Pool expired")]
    PoolExpired,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,

    #[msg("Slippage exceeded")]
    SlippageExceeded,

    #[msg("Pool not resolved")]
    PoolNotResolved,

    #[msg("Pool not expired")]
    PoolNotExpired,

    #[msg("No winnings to claim")]
    NoWinnings,
}
