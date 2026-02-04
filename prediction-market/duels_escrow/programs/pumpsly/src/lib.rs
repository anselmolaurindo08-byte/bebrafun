use anchor_lang::prelude::*;

// Neodyme security.txt standard
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Pumpsly",
    project_url: "https://pumpsly.fun",
    contacts: "link:https://x.com/pumpslyfun",
    policy: "https://github.com/pumpslydev/pumpslyfun/blob/master/SECURITY.md",
    preferred_languages: "en",
    source_code: "https://github.com/pumpslydev/pumpslyfun"
}

declare_id!("6rz87uKkR5nnwsBc6cYJ8EreCFSTcekbEMUou4bkkjCH");

// Fee constants for duel resolution
const DUEL_FEE_BPS: u64 = 250;  // 2.5% fee
const BPS_DIVISOR: u64 = 10_000;

// Fee constants for AMM pool trades
const POOL_FEE_BPS: u64 = 30;  // 0.3% fee (like Uniswap)

#[program]
pub mod pumpsly {
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

        // Transfer SOL deposit to duel PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player_1.to_account_info(),
                to: ctx.accounts.duel.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        let duel = &mut ctx.accounts.duel;
        duel.duel_id = duel_id;
        duel.player_1 = ctx.accounts.player_1.key();
        duel.player_2 = None;
        duel.amount = amount;
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

        emit!(DuelCreated {
            duel_id,
            player_1: ctx.accounts.player_1.key(),
            amount,
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
        
        let duel = &ctx.accounts.duel; // Immutable borrow to get amount
        require!(
            duel.status == DuelStatus::WaitingForPlayer2,
            PredictionMarketError::InvalidDuelStatus
        );
        require!(duel.player_2.is_none(), PredictionMarketError::DuelAlreadyJoined);

        // Transfer SOL deposit to duel PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player_2.to_account_info(),
                to: ctx.accounts.duel.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, duel.amount)?;

        let duel = &mut ctx.accounts.duel; // Mutable borrow after transfer
        duel.player_2 = Some(ctx.accounts.player_2.key());
        duel.player_2_prediction = Some(predicted_outcome);
        duel.status = DuelStatus::Countdown; // Re-added this line

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

    /// Resolve duel with final price and distribute winnings
    pub fn resolve_duel(
        ctx: Context<ResolveDuel>,
        exit_price: u64,
    ) -> Result<()> {
        let duel = &ctx.accounts.duel;
        require!(
            duel.status == DuelStatus::Active,
            PredictionMarketError::InvalidDuelStatus
        );

        // Determine winner based on price movement and predictions
        let price_went_up = exit_price > duel.entry_price;
        let player_1_correct = (duel.player_1_prediction == 1 && price_went_up) ||
                               (duel.player_1_prediction == 0 && !price_went_up);
        
        let winner_pubkey = if player_1_correct {
            duel.player_1
        } else {
            duel.player_2.unwrap()
        };

        // Calculate fee and winner payout
        let total_pool = duel.amount.checked_mul(2).unwrap();
        let fee_amount = total_pool
            .checked_mul(DUEL_FEE_BPS)
            .unwrap()
            .checked_div(BPS_DIVISOR)
            .unwrap();
        let winner_payout = total_pool.checked_sub(fee_amount).unwrap();
        
        let winner_account = if player_1_correct {
            &ctx.accounts.player_1
        } else {
            &ctx.accounts.player_2
        };

        // Transfer fee to platform
        **ctx.accounts.duel.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
        **ctx.accounts.fee_collector.to_account_info().try_borrow_mut_lamports()? += fee_amount;

        // Transfer winnings to winner
        **ctx.accounts.duel.to_account_info().try_borrow_mut_lamports()? -= winner_payout;
        **winner_account.to_account_info().try_borrow_mut_lamports()? += winner_payout;

        // Update duel state
        let duel = &mut ctx.accounts.duel;
        duel.exit_price = exit_price;
        duel.winner = Some(winner_pubkey);
        duel.status = DuelStatus::Resolved;
        duel.resolved_at = Some(Clock::get()?.unix_timestamp);

        emit!(DuelResolved {
            duel_id: duel.duel_id,
            winner: winner_pubkey,
            exit_price,
            payout: winner_payout,
            fee: fee_amount,
        });

        Ok(())
    }

    /// Cancel duel and refund player 1 if player 2 hasn't joined
    pub fn cancel_duel(ctx: Context<CancelDuel>) -> Result<()> {
        let duel = &ctx.accounts.duel;
        
        // Only allow if waiting for player 2
        require!(
            duel.status == DuelStatus::WaitingForPlayer2,
            PredictionMarketError::InvalidDuelStatus
        );
        
        // Only player 1 can cancel
        require!(
            ctx.accounts.player_1.key() == duel.player_1,
            PredictionMarketError::Unauthorized
        );

        // Refund player 1's deposit
        **ctx.accounts.duel.to_account_info().try_borrow_mut_lamports()? -= duel.amount;
        **ctx.accounts.player_1.to_account_info().try_borrow_mut_lamports()? += duel.amount;

        // Update duel state
        let duel = &mut ctx.accounts.duel;
        duel.status = DuelStatus::Cancelled;

        emit!(DuelCancelled {
            duel_id: duel.duel_id,
            refund_amount: duel.amount,
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
        pool.question = question.clone();
        pool.resolution_time = resolution_time;
        pool.yes_reserve = initial_liquidity / 2;
        pool.no_reserve = initial_liquidity / 2;
        pool.total_liquidity = initial_liquidity;
        
        // Set base liquidity for price stability (25 SOL equivalent)
        // This provides stable pricing even with micro-liquidity pools
        let base_amount = 25_000_000_000; // 25 SOL in lamports
        pool.base_yes_liquidity = base_amount / 2;
        pool.base_no_liquidity = base_amount / 2;
        
        pool.outcome = None;
        pool.status = PoolStatus::Active;
        pool.created_at = Clock::get()?.unix_timestamp;
        pool.bump = ctx.bumps.pool;

        // Transfer initial SOL liquidity to pool PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, initial_liquidity)?;

        emit!(PoolCreated {
            pool_id,
            authority: ctx.accounts.authority.key(),
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
        
        let pool = &ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Active,
            PredictionMarketError::PoolNotActive
        );
        require!(
            Clock::get()?.unix_timestamp < pool.resolution_time,
            PredictionMarketError::PoolExpired
        );

        // Calculate tokens out using constant product formula
        // Use combined reserves (real + base) for stable pricing
        let (input_reserve, output_reserve, base_input, base_output) = match outcome {
            Outcome::Yes => (pool.no_reserve, pool.yes_reserve, pool.base_no_liquidity, pool.base_yes_liquidity),
            Outcome::No => (pool.yes_reserve, pool.no_reserve, pool.base_yes_liquidity, pool.base_no_liquidity),
        };

        // Calculate with base liquidity for stable pricing
        let total_input = (input_reserve as u128)
            .checked_add(base_input as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;
        
        let total_output = (output_reserve as u128)
            .checked_add(base_output as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let k = total_input
            .checked_mul(total_output)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_total_input = total_input
            .checked_add(amount as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_total_output = k
            .checked_div(new_total_input)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let tokens_out = total_output
            .checked_sub(new_total_output)
            .ok_or(PredictionMarketError::InsufficientLiquidity)?;

        let tokens_out_u64 = u64::try_from(tokens_out)
            .map_err(|_| PredictionMarketError::MathOverflow)?;

        // Calculate and deduct fee (0.3%)
        let fee = tokens_out_u64
            .checked_mul(POOL_FEE_BPS)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BPS_DIVISOR)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let tokens_out_after_fee = tokens_out_u64
            .checked_sub(fee)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            tokens_out_after_fee >= min_tokens_out,
            PredictionMarketError::SlippageExceeded
        );

        // Transfer SOL payment to pool PDA (BEFORE taking mutable reference)
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // NOW take mutable reference to update reserves
        let pool = &mut ctx.accounts.pool;
        
        // Update reserves - ONLY add the SOL payment
        // Shares are tracked in UserPosition, not in reserves
        match outcome {
            Outcome::Yes => {
                pool.no_reserve += amount;
                // DON'T subtract from yes_reserve - shares are virtual!
            }
            Outcome::No => {
                pool.yes_reserve += amount;
                // DON'T subtract from no_reserve - shares are virtual!
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
            Outcome::Yes => position.yes_tokens += tokens_out_after_fee,
            Outcome::No => position.no_tokens += tokens_out_after_fee,
        }

        emit!(OutcomePurchased {
            pool_id: pool.pool_id,
            user: ctx.accounts.user.key(),
            outcome,
            amount_paid: amount,
            tokens_received: tokens_out_after_fee,
            fee,
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

    /// Manually update pool status (close pool early)
    pub fn update_pool_status(
        ctx: Context<UpdatePoolStatus>,
        new_status: PoolStatus,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        // Only authority can update status
        require!(
            ctx.accounts.authority.key() == pool.authority,
            PredictionMarketError::Unauthorized
        );
        
        pool.status = new_status;
        
        emit!(PoolStatusUpdated {
            pool_id: pool.pool_id,
            new_status,
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

        // Transfer SOL winnings from pool PDA (1:1 payout for winning tokens)
        **ctx.accounts.pool.to_account_info().try_borrow_mut_lamports()? -= winning_tokens;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += winning_tokens;

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

    /// Sell YES or NO outcome tokens back to pool
    pub fn sell_outcome(
        ctx: Context<SellOutcome>,
        outcome: Outcome,
        tokens_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        require!(tokens_amount > 0, PredictionMarketError::InvalidAmount);
        
        let pool = &ctx.accounts.pool;
        require!(
            pool.status == PoolStatus::Active,
            PredictionMarketError::PoolNotActive
        );
        require!(
            Clock::get()?.unix_timestamp < pool.resolution_time,
            PredictionMarketError::PoolExpired
        );

        let position = &mut ctx.accounts.user_position;
        
        // Check user has enough tokens
        let user_tokens = match outcome {
            Outcome::Yes => position.yes_tokens,
            Outcome::No => position.no_tokens,
        };
        require!(
            user_tokens >= tokens_amount,
            PredictionMarketError::InsufficientTokens
        );

        // Calculate SOL out using reverse constant product formula
        // When selling YES: add YES to yes_reserve, remove SOL from no_reserve
        // When selling NO: add NO to no_reserve, remove SOL from yes_reserve
        // Use combined reserves (real + base) for stable pricing
        let (output_reserve, input_reserve, base_output, base_input) = match outcome {
            Outcome::Yes => (pool.no_reserve, pool.yes_reserve, pool.base_no_liquidity, pool.base_yes_liquidity),
            Outcome::No => (pool.yes_reserve, pool.no_reserve, pool.base_yes_liquidity, pool.base_no_liquidity),
        };

        // Calculate with base liquidity for stable pricing
        let total_input = (input_reserve as u128)
            .checked_add(base_input as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;
        
        let total_output = (output_reserve as u128)
            .checked_add(base_output as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let k = total_input
            .checked_mul(total_output)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_total_input = total_input
            .checked_add(tokens_amount as u128)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let new_total_output = k
            .checked_div(new_total_input)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let sol_out = total_output
            .checked_sub(new_total_output)
            .ok_or(PredictionMarketError::InsufficientLiquidity)?;

        let sol_out_u64 = u64::try_from(sol_out)
            .map_err(|_| PredictionMarketError::MathOverflow)?;

        // Calculate and deduct fee (0.3%)
        let fee = sol_out_u64
            .checked_mul(POOL_FEE_BPS)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BPS_DIVISOR)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let sol_out_after_fee = sol_out_u64
            .checked_sub(fee)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            sol_out_after_fee >= min_sol_out,
            PredictionMarketError::SlippageExceeded
        );

        // Transfer SOL from pool PDA to user (BEFORE taking mutable reference)
        **ctx.accounts.pool.to_account_info().try_borrow_mut_lamports()? -= sol_out_after_fee;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += sol_out_after_fee;

        // NOW take mutable reference to update reserves
        let pool = &mut ctx.accounts.pool;

        // Update reserves - ONLY subtract the SOL payout
        // Shares are tracked in UserPosition, not in reserves
        match outcome {
            Outcome::Yes => {
                // DON'T add shares to yes_reserve - shares are virtual!
                pool.no_reserve -= sol_out_u64;
            }
            Outcome::No => {
                // DON'T add shares to no_reserve - shares are virtual!
                pool.yes_reserve -= sol_out_u64;
            }
        }

        // Update user position
        match outcome {
            Outcome::Yes => position.yes_tokens -= tokens_amount,
            Outcome::No => position.no_tokens -= tokens_amount,
        }

        emit!(OutcomeSold {
            pool_id: pool.pool_id,
            user: ctx.accounts.user.key(),
            outcome,
            tokens_sold: tokens_amount,
            sol_received: sol_out_after_fee,
            fee,
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
    pub question: String,
    pub resolution_time: i64,
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub total_liquidity: u64,
    /// Base liquidity for YES side (for price stability)
    pub base_yes_liquidity: u64,
    /// Base liquidity for NO side (for price stability)
    pub base_no_liquidity: u64,
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
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
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

    #[account(mut)]
    pub player_1: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, Duel>,

    #[account(mut)]
    pub player_2: Signer<'info>,

    pub system_program: Program<'info, System>,
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

    /// CHECK: Player 1 account to receive winnings
    #[account(mut)]
    pub player_1: AccountInfo<'info>,

    /// CHECK: Player 2 account to receive winnings
    #[account(mut)]
    pub player_2: AccountInfo<'info>,

    /// Platform fee collector account
    /// CHECK: Fee collector SOL account
    #[account(mut)]
    pub fee_collector: AccountInfo<'info>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelDuel<'info> {
    #[account(mut)]
    pub duel: Account<'info, Duel>,

    #[account(mut)]
    pub player_1: Signer<'info>,

    pub system_program: Program<'info, System>,
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

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyOutcome<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 80,
        seeds = [b"position", pool.pool_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolvePool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePoolStatus<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellOutcome<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct DuelCreated {
    pub duel_id: u64,
    pub player_1: Pubkey,
    pub amount: u64,
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
    pub fee: u64,
}

#[event]
pub struct DuelCancelled {
    pub duel_id: u64,
    pub refund_amount: u64,
}

#[event]
pub struct PoolCreated {
    pub pool_id: u64,
    pub authority: Pubkey,
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
    pub fee: u64,
}

#[event]
pub struct OutcomeSold {
    pub pool_id: u64,
    pub user: Pubkey,
    pub outcome: Outcome,
    pub tokens_sold: u64,
    pub sol_received: u64,
    pub fee: u64,
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

#[event]
pub struct PoolStatusUpdated {
    pub pool_id: u64,
    pub new_status: PoolStatus,
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

    #[msg("Insufficient tokens")]
    InsufficientTokens,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Cancel too early - must wait 5 minutes")]
    CancelTooEarly,
}
