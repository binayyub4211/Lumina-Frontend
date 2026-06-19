# Quick Start Guide - Optimistic UI for Soroban Transactions

Get up and running with the optimistic UI implementation in 5 minutes.

---

## 🚀 Installation

### Step 1: Enable PowerShell (if needed)

If you see "running scripts is disabled" error:

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install the new `@stellar/stellar-sdk` dependency.

---

## ✅ Verification

### Quick Test

```bash
# Run all tests (should take ~5 seconds)
npm run test:all

# Expected output: All tests passing ✅
```

### Type Check

```bash
npm run typecheck

# Expected: No errors ✅
```

---

## 🎨 See It In Action

### Start the Dev Server

```bash
npm run dev
```

### Open the Demo Page

Navigate to: **http://localhost:3000/escrow**

### Try It Out

1. **Deposit Flow**:
   - Enter amount (e.g., "10")
   - Click "Deposit"
   - Balance updates **instantly** (no 3-7 second wait!)
   - Transaction confirms in background

2. **Withdraw Flow**:
   - Enter amount
   - Click "Withdraw"
   - Balance updates **instantly**
   - See pending transaction in queue below

3. **Error Handling**:
   - Try withdrawing more than balance
   - Balance briefly drops
   - **Rolls back within 200ms**
   - Error toast appears with user-friendly message

4. **Duplicate Prevention**:
   - Double-click submit button rapidly
   - Only **one** transaction created
   - Button disabled during submission

---

## 💻 Basic Usage

### Import the Hook

```typescript
import { useSorobanBilling } from "@/src/hooks/useSorobanBilling";
```

### Use in Your Component

```typescript
function MyComponent() {
  const {
    billingData,              // Current balance
    submitWithOptimisticUpdate, // Submit with instant UI
    isSubmitting,             // Prevent double-clicks
  } = useSorobanBilling();

  const handleDeposit = async () => {
    const amount = 10_0000000n; // 10 XLM in stroops

    const result = await submitWithOptimisticUpdate({
      contractId: "YOUR_CONTRACT_ID",
      method: "deposit",
      args: [amount],
      txXdr: "YOUR_TRANSACTION_XDR",
      delta: {
        amount,
        operation: "deposit",
      },
    });

    if (result.success) {
      console.log("Success:", result.hash);
    } else {
      console.error("Error:", result.error);
    }
  };

  return (
    <div>
      <p>Balance: {billingData?.formattedBalance} XLM</p>
      <button 
        onClick={handleDeposit} 
        disabled={isSubmitting}
      >
        Deposit
      </button>
    </div>
  );
}
```

---

## 🔧 Configuration

### Default Settings

All settings have sensible defaults:

```typescript
// Optimistic update timeout: 50ms
// Rollback timeout: 200ms
// SessionStorage TTL: 5 minutes
// Max retry attempts: 3
// Submission timeout: 30 seconds
```

### No Configuration Needed!

The implementation works out-of-the-box. Just use the hook.

---

## 📚 Key Files

### If You Need to Modify

| File | Purpose | When to Edit |
|------|---------|--------------|
| `src/hooks/useSorobanBilling.ts` | Main hook | Add new methods |
| `src/lib/OptimisticTransactionManager.ts` | Core logic | Change timing thresholds |
| `src/components/wallet/EscrowPanel.tsx` | UI component | Customize UI |
| `src/services/localCache.ts` | Cache service | Change TTL defaults |

---

## 🧪 Testing Your Changes

### Run Tests After Modifications

```bash
# Test specific component
npm run test:optimistic  # OptimisticTransactionManager
npm run test:cache       # LocalCache
npm run test:queue       # TransactionQueue

# Run all tests
npm run test:all
```

### Check TypeScript

```bash
npm run typecheck
```

---

## 🎯 Common Patterns

### 1. Deposit with Optimistic UI

```typescript
await submitWithOptimisticUpdate({
  contractId: CONTRACT_ID,
  method: "deposit",
  args: [amount],
  txXdr: buildDepositTx(amount),
  delta: {
    amount,
    operation: "deposit", // Balance increases
  },
});
```

### 2. Withdraw with Optimistic UI

```typescript
await submitWithOptimisticUpdate({
  contractId: CONTRACT_ID,
  method: "withdraw",
  args: [amount],
  txXdr: buildWithdrawTx(amount),
  delta: {
    amount,
    operation: "withdraw", // Balance decreases
  },
});
```

### 3. Handle Errors

```typescript
const result = await submitWithOptimisticUpdate({...});

if (!result.success) {
  // Error already rolled back automatically
  showErrorToast(result.error);
}
```

### 4. Manual Balance Refresh

```typescript
const { refetchBalance } = useSorobanBilling();

// Force refresh from backend
await refetchBalance();
```

---

## 🔍 Debugging

### Enable Console Logs

Performance warnings are logged automatically:

```
⚠️ Optimistic update took 75.32ms (target: <50ms)
⚠️ Rollback took 250.12ms (target: <200ms)
```

### Check React Query DevTools

Add React Query DevTools to see cache state:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<ReactQueryDevtools initialIsOpen={false} />
```

### Inspect SessionStorage

Open browser DevTools → Application → Session Storage:

- Look for keys starting with `lumina-cache:`
- Snapshots expire after 5 minutes

---

## 🚨 Troubleshooting

### "Cannot find module '@stellar/stellar-sdk'"

**Solution**: Run `npm install`

### "sessionStorage is not defined" in tests

**Solution**: Tests mock sessionStorage automatically - this is normal

### Balance doesn't update instantly

**Check**:
1. Is wallet connected?
2. Is `isSubmitting` false before clicking?
3. Check browser console for errors

### Rollback doesn't trigger

**Check**:
1. Did transaction actually fail?
2. Check console for rollback timing warnings
3. Verify `previousData` is being captured

---

## 📖 Next Steps

### For Development

1. ✅ Follow this Quick Start (you are here!)
2. 📖 Read `OPTIMISTIC_UI_IMPLEMENTATION.md` for deep dive
3. ✅ Check `VERIFICATION_CHECKLIST.md` before deploying

### For Production

1. 🔐 Add server-side nonce validation
2. 🔑 Integrate Stellar SDK for real transaction building
3. 🧪 Add E2E tests with Playwright
4. 📊 Add analytics for performance tracking
5. 🚀 Deploy to staging → production

---

## 💡 Pro Tips

### Tip 1: Use TypeScript Strictly

The implementation has full type safety:

```typescript
import type { BalanceDelta } from "@/src/lib/OptimisticTransactionManager";

const delta: BalanceDelta = {
  amount: 1000000n,      // bigint required
  operation: "deposit",  // "deposit" | "withdraw" only
};
```

### Tip 2: Disable Submit Button

Always disable during submission:

```typescript
<button disabled={isSubmitting}>
  {isSubmitting ? "Processing..." : "Submit"}
</button>
```

### Tip 3: Show Toast Notifications

Users need feedback on success/failure:

```typescript
if (result.success) {
  showSuccessToast("Transaction submitted!");
} else {
  showErrorToast(result.error);
}
```

### Tip 4: Refetch After 3 Seconds

Balance automatically refetches after submission, but you can force:

```typescript
setTimeout(async () => {
  await refetchBalance();
}, 3000);
```

---

## 🎉 You're Ready!

The optimistic UI is now fully integrated. Your users will experience:

✅ **Instant feedback** (<50ms updates)  
✅ **Fast rollbacks** (<200ms on errors)  
✅ **No duplicate submissions** (nonce deduplication)  
✅ **Crash recovery** (survives tab refreshes)  
✅ **User-friendly errors** (no raw error codes)  

---

## 📚 Additional Resources

- **Full Documentation**: `OPTIMISTIC_UI_IMPLEMENTATION.md`
- **Verification Guide**: `VERIFICATION_CHECKLIST.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Test Files**: `src/lib/__tests__/`, `src/services/__tests__/`

---

## ❓ Questions?

If something isn't working:

1. Check the troubleshooting section above
2. Review the verification checklist
3. Look at test files for usage examples
4. Check browser console for errors/warnings

---

**Happy coding!** 🚀
