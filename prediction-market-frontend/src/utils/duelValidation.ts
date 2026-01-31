import { DUEL_CONSTANTS, DuelCurrency } from '../types/duel';
import type { ValidationResult } from '../types/duel';

export class DuelValidator {
  static validateBetAmount(
    amount: number,
    currency: DuelCurrency,
  ): ValidationResult {
    if (amount <= 0) {
      return { valid: false, error: 'Bet amount must be greater than 0' };
    }

    if (amount < DUEL_CONSTANTS.MIN_BET_AMOUNT) {
      return {
        valid: false,
        error: `Minimum bet amount is ${DUEL_CONSTANTS.MIN_BET_AMOUNT} ${currency === DuelCurrency.SOL ? 'SOL' : '$PUMP'}`,
      };
    }

    if (amount > DUEL_CONSTANTS.MAX_BET_AMOUNT) {
      return {
        valid: false,
        error: `Maximum bet amount is ${DUEL_CONSTANTS.MAX_BET_AMOUNT} ${currency === DuelCurrency.SOL ? 'SOL' : '$PUMP'}`,
      };
    }

    return { valid: true };
  }

  static validateCurrency(currency: DuelCurrency): ValidationResult {
    if (currency !== DuelCurrency.SOL && currency !== DuelCurrency.PUMP) {
      return { valid: false, error: 'Invalid currency selection' };
    }
    return { valid: true };
  }

  static validateTransactionHash(hash: string): ValidationResult {
    if (!hash || hash.length === 0) {
      return { valid: false, error: 'Transaction hash is required' };
    }

    if (hash.length < 32) {
      return { valid: false, error: 'Invalid transaction hash format' };
    }

    return { valid: true };
  }

  static validateConfirmations(
    confirmations: number,
    required: number = DUEL_CONSTANTS.REQUIRED_CONFIRMATIONS,
  ): ValidationResult {
    if (confirmations < 0) {
      return { valid: false, error: 'Confirmations cannot be negative' };
    }

    if (confirmations < required) {
      return {
        valid: false,
        error: `Requires ${required} confirmations, got ${confirmations}`,
      };
    }

    return { valid: true };
  }

  static validatePrice(price: number): ValidationResult {
    if (price <= 0) {
      return { valid: false, error: 'Price must be greater than 0' };
    }

    if (!isFinite(price)) {
      return { valid: false, error: 'Invalid price value' };
    }

    return { valid: true };
  }
}
