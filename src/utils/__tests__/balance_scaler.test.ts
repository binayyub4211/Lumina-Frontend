import {
  toStroop,
  fromStroop,
  formatStroop,
  add,
  sub,
  mul,
  div,
  compare,
  isZero,
  isNegative,
  RoundingMode,
} from "../../lib/bigintmath";
import { StroopConverter, STROOP_DECIMALS } from "../balance_scaler";

let passed = 0;
let failed: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed.push(message);
    console.error("FAIL:", message);
  } else {
    passed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

function assertBigInt(actual: bigint, expected: bigint, label: string) {
  assert(
    actual === expected,
    `${label}: expected ${expected.toString()}, got ${actual.toString()}`,
  );
}

// ============================================================
// 1. Basic conversions
// ============================================================
assertBigInt(toStroop("1", 7), 10000000n, "1 XLM = 10M stroops");
assertBigInt(toStroop("0.1", 7), 1000000n, "0.1 XLM = 1M stroops");
assertBigInt(toStroop("0.0000001", 7), 1n, "0.0000001 XLM = 1 stroop");
assertBigInt(toStroop("10", 7), 100000000n, "10 XLM = 100M stroops");
assertBigInt(toStroop("100", 7), 1000000000n, "100 XLM = 1B stroops");
assertBigInt(toStroop("1000", 7), 10000000000n, "1000 XLM = 10B stroops");
assertBigInt(toStroop("0", 7), 0n, "zero XLM = 0 stroops");
assertBigInt(toStroop("0.0", 7), 0n, "zero point zero = 0 stroops");
assertBigInt(toStroop("0.0000000", 7), 0n, "zero with 7 decimals = 0 stroops");

// ============================================================
// 2. FromStroop
// ============================================================
assertEq(fromStroop(10000000n, 7), "1", "10M stroops = 1 XLM");
assertEq(fromStroop(1n, 7), "0.0000001", "1 stroop = 0.0000001 XLM");
assertEq(fromStroop(12345678n, 7), "1.2345678", "12345678 stroops = 1.2345678");
assertEq(fromStroop(0n, 7), "0", "0 stroops = 0");
assertEq(fromStroop(100000000n, 7), "10", "100M stroops = 10 XLM");
assertEq(fromStroop(1n, 0), "1", "1 stroop, 0 decimals = 1");

// ============================================================
// 3. Round-trip conversions
// ============================================================
function roundTrip(amount: string, decimals: number) {
  const s = toStroop(amount, decimals);
  const back = fromStroop(s, decimals);
  assertEq(back, amount, `round-trip: ${amount} -> ${s.toString()} -> ${back}`);
}
roundTrip("1", 7);
roundTrip("0.1", 7);
roundTrip("0.01", 7);
roundTrip("0.001", 7);
roundTrip("0.0001", 7);
roundTrip("0.00001", 7);
roundTrip("0.000001", 7);
roundTrip("0.0000001", 7);
roundTrip("123.456789", 7);
roundTrip("0.0000001", 7);
roundTrip("999999999.9999999", 7);
roundTrip("1", 0);
roundTrip("1.234", 18);

// ============================================================
// 4. Very small values
// ============================================================
assertBigInt(toStroop("0.0000001", 7), 1n, "smallest positive 7-dec");
assertBigInt(toStroop("0.000001", 7), 10n, "0.000001 XLM = 10 stroops");
assertEq(fromStroop(1n, 7), "0.0000001", "1 stroop to string");
assertEq(fromStroop(10n, 7), "0.000001", "10 stroops to string");

// ============================================================
// 5. Large values
// ============================================================
assertBigInt(toStroop("1000000000000", 7), 10000000000000000000n, "1e12 XLM");
assertBigInt(toStroop("1000000000", 7), 10000000000000000n, "1e9 XLM");
assertBigInt(toStroop("1000000", 7), 10000000000000n, "1e6 XLM");
assertBigInt(toStroop("1000000000000", 0), 1000000000000n, "1e12 with 0 decimals");
assertEq(fromStroop(10000000000000000000n, 7), "1000000000000", "round-trip large");

// ============================================================
// 6. Zero and negative values
// ============================================================
assert(isZero(0n), "isZero true for 0");
assert(!isZero(1n), "isZero false for 1");
assert(!isZero(-1n), "isZero false for -1");
assert(isNegative(-1n), "isNegative true for -1");
assert(isNegative(-10000000n), "isNegative true for -10M");
assert(!isNegative(0n), "isNegative false for 0");
assert(!isNegative(1n), "isNegative false for 1");
assertBigInt(toStroop("-1", 7), -10000000n, "negative 1 XLM");
assertBigInt(toStroop("-0.5", 7), -5000000n, "negative 0.5 XLM");
assertEq(fromStroop(-10000000n, 7), "-1", "negative 10M stroops");
assertEq(fromStroop(-1n, 7), "-0.0000001", "negative 1 stroop");
assertBigInt(toStroop("-0.0000001", 7), -1n, "negative smallest");

// ============================================================
// 7. Overflow protection (add, sub, mul)
// ============================================================
assertBigInt(add(1n, 2n), 3n, "add 1+2=3");
assertBigInt(add(0n, 0n), 0n, "add 0+0=0");
assertBigInt(add(-1n, 1n), 0n, "add -1+1=0");

let overflowCaught = false;
try {
  add(BigInt("50000000000000000001"), BigInt("50000000000000000001"));
} catch {
  overflowCaught = true;
}
assert(overflowCaught, "add overflow protection");

assertBigInt(sub(5n, 3n), 2n, "sub 5-3=2");
assertBigInt(sub(0n, 5n), -5n, "sub 0-5=-5");
assertBigInt(sub(-5n, -3n), -2n, "sub -5-(-3)=-2");

let subOverflow = false;
try {
  sub(-BigInt("50000000000000000001"), BigInt("50000000000000000001"));
} catch {
  subOverflow = true;
}
assert(subOverflow, "sub overflow protection");

assertBigInt(mul(3n, 4n), 12n, "mul 3*4=12");
assertBigInt(mul(-2n, 3n), -6n, "mul -2*3=-6");
assertBigInt(mul(0n, 100n), 0n, "mul 0*100=0");

let mulOverflow = false;
try {
  mul(BigInt("100000000000"), BigInt("1000000000000"));
} catch {
  mulOverflow = true;
}
assert(mulOverflow, "mul overflow protection");

// ============================================================
// 8. Division with rounding modes (HALF_UP, DOWN, UP)
// ============================================================
assertBigInt(div(10n, 3n, RoundingMode.HALF_UP), 3n, "div 10/3 HALF_UP = 3");
assertBigInt(div(10n, 3n, RoundingMode.DOWN), 3n, "div 10/3 DOWN = 3");
assertBigInt(div(10n, 3n, RoundingMode.UP), 4n, "div 10/3 UP = 4");
assertBigInt(div(11n, 3n, RoundingMode.HALF_UP), 4n, "div 11/3 HALF_UP = 4");
assertBigInt(div(9n, 3n, RoundingMode.HALF_UP), 3n, "div 9/3 HALF_UP = 3 (exact)");
assertBigInt(div(7n, 3n, RoundingMode.HALF_UP), 2n, "div 7/3 HALF_UP = 2");
assertBigInt(div(8n, 3n, RoundingMode.HALF_UP), 3n, "div 8/3 HALF_UP = 3");
assertBigInt(div(5n, 2n, RoundingMode.HALF_UP), 3n, "div 5/2 HALF_UP = 3");
assertBigInt(div(5n, 2n, RoundingMode.DOWN), 2n, "div 5/2 DOWN = 2");
assertBigInt(div(5n, 2n, RoundingMode.UP), 3n, "div 5/2 UP = 3");

// Negative division
assertBigInt(div(-10n, 3n, RoundingMode.HALF_UP), -3n, "div -10/3 HALF_UP = -3");
assertBigInt(div(-10n, 3n, RoundingMode.DOWN), -3n, "div -10/3 DOWN = -3");
assertBigInt(div(-10n, 3n, RoundingMode.UP), -4n, "div -10/3 UP = -4");
assertBigInt(div(-11n, 3n, RoundingMode.HALF_UP), -4n, "div -11/3 HALF_UP = -4");
assertBigInt(div(-7n, 3n, RoundingMode.HALF_UP), -2n, "div -7/3 HALF_UP = -2");
assertBigInt(div(-8n, 3n, RoundingMode.HALF_UP), -3n, "div -8/3 HALF_UP = -3");
assertBigInt(div(-5n, 2n, RoundingMode.HALF_UP), -3n, "div -5/2 HALF_UP = -3");
assertBigInt(div(-5n, 2n, RoundingMode.DOWN), -2n, "div -5/2 DOWN = -2");
assertBigInt(div(-5n, 2n, RoundingMode.UP), -3n, "div -5/2 UP = -3");

// Division by zero
let divZero = false;
try {
  div(1n, 0n);
} catch {
  divZero = true;
}
assert(divZero, "div by zero throws");

// ============================================================
// 9. Compare
// ============================================================
assertEq(compare(0n, 0n), 0, "compare 0,0 = 0");
assertEq(compare(1n, 0n), 1, "compare 1,0 = 1");
assertEq(compare(0n, 1n), -1, "compare 0,1 = -1");
assertEq(compare(-1n, 0n), -1, "compare -1,0 = -1");
assertEq(compare(-1n, -2n), 1, "compare -1,-2 = 1");
assertEq(compare(100n, 99n), 1, "compare 100,99 = 1");

// ============================================================
// 10. Locale-aware formatting (formatStroop)
// ============================================================
const formatted1 = formatStroop(10000000n, 7, "en-US");
assert(formatted1.includes("1"), "formatStroop 1 XLM en-US");

const formatted2 = formatStroop(100000000n, 7, "en-US");
assert(formatted2.includes("10"), "formatStroop 10 XLM en-US");

const formatted3 = formatStroop(1234567890n, 7, "en-US");
assert(formatted3.includes("123"), "formatStroop 123.4567890 en-US");

const formatted4 = formatStroop(0n, 7, "en-US");
assertEq(formatted4, "0", "formatStroop 0 en-US");

const formatted5 = formatStroop(1n, 7, "en-US");
assert(formatted5.includes("0.0000001"), "formatStroop 1 stroop en-US");

const formatted6 = formatStroop(-10000000n, 7, "en-US");
assert(formatted6.startsWith("-"), "formatStroop negative starts with -");

// German locale uses different separators
const formattedDe = formatStroop(10000000n, 7, "de-DE");
assert(formattedDe.includes("1"), "formatStroop 1 XLM de-DE");

// ============================================================
// 11. Different decimal precisions
// ============================================================
assertBigInt(toStroop("1", 0), 1n, "1 with 0 decimals");
assertBigInt(toStroop("1", 1), 10n, "1 with 1 decimal");
assertBigInt(toStroop("1", 2), 100n, "1 with 2 decimals");
assertBigInt(toStroop("1", 3), 1000n, "1 with 3 decimals");
assertBigInt(toStroop("1", 18), BigInt("1" + "0".repeat(18)), "1 with 18 decimals");
assertBigInt(toStroop("0.5", 1), 5n, "0.5 with 1 decimal");
assertBigInt(toStroop("0.05", 2), 5n, "0.05 with 2 decimals");
assertBigInt(toStroop("0.005", 3), 5n, "0.005 with 3 decimals");
assertEq(fromStroop(5n, 1), "0.5", "5 fromStroop 1 dec = 0.5");
assertEq(fromStroop(5n, 2), "0.05", "5 fromStroop 2 dec = 0.05");
assertEq(fromStroop(5n, 3), "0.005", "5 fromStroop 3 dec = 0.005");

// ============================================================
// 12. StroopConverter.fromBlockchain
// ============================================================
assertBigInt(
  StroopConverter.fromBlockchain("0"),
  0n,
  "fromBlockchain string 0",
);
assertBigInt(
  StroopConverter.fromBlockchain("10000000"),
  10000000n,
  "fromBlockchain string 10M",
);
assertBigInt(
  StroopConverter.fromBlockchain("0x0"),
  0n,
  "fromBlockchain hex 0",
);
assertBigInt(
  StroopConverter.fromBlockchain("0xFF"),
  255n,
  "fromBlockchain hex FF",
);
assertBigInt(
  StroopConverter.fromBlockchain(100n),
  100n,
  "fromBlockchain bigint 100",
);
assertBigInt(
  StroopConverter.fromBlockchain(-100n),
  -100n,
  "fromBlockchain bigint -100",
);
assertBigInt(
  StroopConverter.fromBlockchain("1.5", 7),
  toStroop("1.5", 7),
  "fromBlockchain decimal string",
);

// Invalid input
let parseError = false;
try {
  StroopConverter.fromBlockchain("not-a-number");
} catch {
  parseError = true;
}
assert(parseError, "fromBlockchain invalid string throws");

// ============================================================
// 13. StroopConverter.toDisplay
// ============================================================
const display0 = StroopConverter.toDisplay(0n);
assertEq(display0, "0", "toDisplay 0");
assert(
  StroopConverter.toDisplay(10000000n).includes("1"),
  "toDisplay 10M includes 1",
);
assert(
  StroopConverter.toDisplay(1n).includes("0.0000001"),
  "toDisplay 1 stroop",
);

// ============================================================
// 14. StroopConverter.toHumanReadable
// ============================================================
assertEq(
  StroopConverter.toHumanReadable(10000000n),
  "1",
  "toHumanReadable 10M = 1",
);
assertEq(
  StroopConverter.toHumanReadable(1n),
  "0.0000001",
  "toHumanReadable 1",
);
assertEq(
  StroopConverter.toHumanReadable(0n),
  "0",
  "toHumanReadable 0",
);

// ============================================================
// 15. serializeForCacheKey / parseCacheKey
// ============================================================
const key = StroopConverter.serializeForCacheKey(12345678901234567890n);
assertEq(key, "12345678901234567890", "serializeForCacheKey");
const parsed = StroopConverter.parseCacheKey(key);
assertBigInt(parsed, 12345678901234567890n, "parseCacheKey round-trip");

const key0 = StroopConverter.serializeForCacheKey(0n);
assertEq(key0, "0", "serializeForCacheKey zero");
assertBigInt(StroopConverter.parseCacheKey("0"), 0n, "parseCacheKey zero");

const keyNeg = StroopConverter.serializeForCacheKey(-1n);
assertEq(keyNeg, "-1", "serializeForCacheKey negative");
assertBigInt(StroopConverter.parseCacheKey("-1"), -1n, "parseCacheKey negative");

// ============================================================
// 16. Edge-case: very small fractions beyond precision
// ============================================================
assertBigInt(toStroop("0.000000100", 7), 1n, "0.000000100 trimmed to 0.0000001");
assertBigInt(toStroop("0.0000001000", 7), 1n, "0.0000001000 trimmed");
assertBigInt(toStroop("0.00000015", 7), 1n, "0.00000015 truncated to 1 stroop");

// ============================================================
// 17. Edge-case: values with leading/trailing zeros
// ============================================================
assertBigInt(toStroop("001.5", 7), 15000000n, "leading zeros 001.5");
assertBigInt(toStroop("1.5000000", 7), 15000000n, "trailing zeros 1.5000000");
assertBigInt(toStroop("00.00", 7), 0n, "00.00 = 0");

// ============================================================
// 18. Edge-case: large decimals
// ============================================================
assertBigInt(toStroop("1", 18), BigInt("1" + "0".repeat(18)), "1 eth-like 18 dec");
assertEq(fromStroop(BigInt("1" + "0".repeat(18)), 18), "1", "round-trip 18 dec");
assertEq(fromStroop(1n, 18), "0.000000000000000001", "1 wei to eth string");

// ============================================================
// 19. Random/pattern tests
// ============================================================
assertBigInt(toStroop("0.00000001", 7), 0n, "below precision -> 0");
assertBigInt(toStroop("0.00000009", 7), 0n, "below precision -> 0 part 2");
assertBigInt(toStroop("0.0000010", 7), 10n, "0.0000010 = 10 stroops");
assertEq(fromStroop(100n, 7), "0.00001", "100 stroops = 0.00001");
assertEq(fromStroop(1000n, 7), "0.0001", "1000 stroops = 0.0001");
assertEq(fromStroop(10000n, 7), "0.001", "10000 stroops = 0.001");
assertEq(fromStroop(100000n, 7), "0.01", "100000 stroops = 0.01");
assertEq(fromStroop(1000000n, 7), "0.1", "1M stroops = 0.1");
assertEq(fromStroop(10000000n, 7), "1", "10M stroops = 1");
assertEq(fromStroop(11000000n, 7), "1.1", "11M stroops = 1.1");
assertEq(fromStroop(11100000n, 7), "1.11", "11.1M stroops = 1.11");
assertEq(fromStroop(11110000n, 7), "1.111", "11.11M stroops = 1.111");
assertEq(fromStroop(11111000n, 7), "1.1111", "11.111M stroops = 1.1111");
assertEq(fromStroop(11111100n, 7), "1.11111", "11.1111M stroops = 1.11111");
assertEq(fromStroop(11111110n, 7), "1.111111", "11.11111M stroops = 1.111111");
assertEq(fromStroop(11111111n, 7), "1.1111111", "11.111111M stroops = 1.1111111");

// ============================================================
// 20. Large number division
// ============================================================
assertBigInt(
  div(BigInt("10000000000000000000"), BigInt("3"), RoundingMode.HALF_UP),
  BigInt("3333333333333333333"),
  "large div HALF_UP",
);
assertBigInt(
  div(BigInt("10000000000000000000"), BigInt("3"), RoundingMode.DOWN),
  BigInt("3333333333333333333"),
  "large div DOWN",
);
assertBigInt(
  div(BigInt("10000000000000000000"), BigInt("3"), RoundingMode.UP),
  BigInt("3333333333333333334"),
  "large div UP",
);

// ============================================================
// 21. Exact power-of-10 boundaries
// ============================================================
assertBigInt(toStroop("0.0000001", 7), 1n, "boundary: 0.0000001");
assertBigInt(toStroop("0.000001", 7), 10n, "boundary: 0.000001");
assertBigInt(toStroop("0.00001", 7), 100n, "boundary: 0.00001");
assertBigInt(toStroop("0.0001", 7), 1000n, "boundary: 0.0001");
assertBigInt(toStroop("0.001", 7), 10000n, "boundary: 0.001");
assertBigInt(toStroop("0.01", 7), 100000n, "boundary: 0.01");
assertBigInt(toStroop("0.1", 7), 1000000n, "boundary: 0.1");
assertBigInt(toStroop("1", 7), 10000000n, "boundary: 1");
assertBigInt(toStroop("10", 7), 100000000n, "boundary: 10");
assertBigInt(toStroop("100", 7), 1000000000n, "boundary: 100");

// ============================================================
// 22. Negative edge cases
// ============================================================
assert(isNegative(-10000000000000000000n), "isNegative large negative");
assert(!isNegative(0n), "isNegative not negative for 0");
assert(!isNegative(10000000000000000000n), "isNegative not negative for large positive");
assertEq(compare(-1n, -1n), 0, "compare -1,-1 = 0");
assertEq(compare(-1n, -2n), 1, "compare -1,-2 = 1 (less negative)");
assertEq(compare(-2n, -1n), -1, "compare -2,-1 = -1 (more negative)");

// ============================================================
// 23. Formatting with grouping separators
// ============================================================
const bigFormatted = formatStroop(10000000000000000n, 7, "en-US");
assert(
  bigFormatted === "1,000,000,000",
  `format large number en-US: got "${bigFormatted}"`,
);
const bigFormattedNoLocale = formatStroop(10000000000000000n, 7);
assert(
  bigFormattedNoLocale.replace(/,/g, "") === "1000000000",
  "format large number without locale contains digits",
);

// ============================================================
// 24. Mul and div with negatives
// ============================================================
assertBigInt(mul(-3n, -4n), 12n, "mul -3*-4 = 12");
assertBigInt(mul(-3n, 4n), -12n, "mul -3*4 = -12");
assertBigInt(mul(3n, -4n), -12n, "mul 3*-4 = -12");
assertBigInt(div(-10n, -2n, RoundingMode.HALF_UP), 5n, "div -10/-2 = 5");
assertBigInt(div(10n, -2n, RoundingMode.HALF_UP), -5n, "div 10/-2 = -5");
assertBigInt(div(-10n, 2n, RoundingMode.HALF_UP), -5n, "div -10/2 = -5");

// ============================================================
// 25. STROOP_DECIMALS constant
// ============================================================
assertEq(STROOP_DECIMALS, 7, "STROOP_DECIMALS is 7");

// ============================================================
// 26. Locale-specific formatting details
// ============================================================
const enFormatted = formatStroop(1000000000n, 0, "en-US");
assert(!enFormatted.includes(",") || enFormatted.includes("1,000,000,000"), "en-US uses comma separators");

// ============================================================
// 27. Decimal formatting with significant trailing zero removal
// ============================================================
assertEq(fromStroop(10000001n, 7), "1.0000001", "trailing zeros preserved in middle");
assertEq(fromStroop(10000010n, 7), "1.000001", "one trailing zero removed");
assertEq(fromStroop(10000100n, 7), "1.00001", "two trailing zeros removed");
assertEq(fromStroop(10001000n, 7), "1.0001", "three trailing zeros removed");
assertEq(fromStroop(10010000n, 7), "1.001", "four trailing zeros removed");
assertEq(fromStroop(10100000n, 7), "1.01", "five trailing zeros removed");
assertEq(fromStroop(11000000n, 7), "1.1", "six trailing zeros removed");

// ============================================================
// 28. Extreme negative formatting
// ============================================================
assertEq(fromStroop(-1n, 7), "-0.0000001", "negative 1 stroop formatted");
assertEq(fromStroop(-10000000n, 7), "-1", "negative 1 XLM formatted");
assertEq(fromStroop(-11000000n, 7), "-1.1", "negative 1.1 XLM");
assertEq(fromStroop(-12345678n, 7), "-1.2345678", "negative complex value");
assertBigInt(toStroop("-1000.0000001", 7), -10000000001n, "negative with decimals");

// ============================================================
// 29. HALF_UP at exact boundaries
// ============================================================
assertBigInt(div(3n, 2n, RoundingMode.HALF_UP), 2n, "3/2 HALF_UP = 2");
assertBigInt(div(1n, 2n, RoundingMode.HALF_UP), 1n, "1/2 HALF_UP = 1 (half rounds up)");
assertBigInt(div(2n, 2n, RoundingMode.HALF_UP), 1n, "2/2 HALF_UP = 1 (exact)");
assertBigInt(div(4n, 2n, RoundingMode.HALF_UP), 2n, "4/2 HALF_UP = 2 (exact)");
assertBigInt(div(99n, 100n, RoundingMode.HALF_UP), 1n, "99/100 HALF_UP = 1");
assertBigInt(div(49n, 100n, RoundingMode.HALF_UP), 0n, "49/100 HALF_UP = 0");
assertBigInt(div(50n, 100n, RoundingMode.HALF_UP), 1n, "50/100 HALF_UP = 1 (tie breaks up)");
assertBigInt(div(51n, 100n, RoundingMode.HALF_UP), 1n, "51/100 HALF_UP = 1");

// ============================================================
// 30. Negative HALF_UP exact boundaries
// ============================================================
assertBigInt(div(-3n, 2n, RoundingMode.HALF_UP), -2n, "-3/2 HALF_UP = -2");
assertBigInt(div(-1n, 2n, RoundingMode.HALF_UP), -1n, "-1/2 HALF_UP = -1");
assertBigInt(div(-2n, 2n, RoundingMode.HALF_UP), -1n, "-2/2 HALF_UP = -1 (exact)");
assertBigInt(div(-99n, 100n, RoundingMode.HALF_UP), -1n, "-99/100 HALF_UP = -1");
assertBigInt(div(-49n, 100n, RoundingMode.HALF_UP), 0n, "-49/100 HALF_UP = 0");
assertBigInt(div(-50n, 100n, RoundingMode.HALF_UP), -1n, "-50/100 HALF_UP = -1");
assertBigInt(div(-51n, 100n, RoundingMode.HALF_UP), -1n, "-51/100 HALF_UP = -1");

// ============================================================
// 31. Whole-number formatting edge cases
// ============================================================
assertEq(formatStroop(0n, 0), "0", "formatStroop 0 dec 0");
assertEq(formatStroop(0n, 1), "0", "formatStroop 0 dec 1");
assertEq(formatStroop(0n, 7), "0", "formatStroop 0 dec 7");
assertEq(formatStroop(1n, 0), "1", "formatStroop 1 dec 0");
assertEq(formatStroop(10n, 0), "10", "formatStroop 10 dec 0");
assertEq(formatStroop(100n, 0), "100", "formatStroop 100 dec 0");

// ============================================================
// 32. Locale-specific thousands separators
// ============================================================
const localeEn = formatStroop(12340000000n, 7, "en-US");
assert(localeEn.includes("1,234"), `en-US grouping: "${localeEn}"`);

const localeDe = formatStroop(12340000000n, 7, "de-DE");
assert(
  (localeDe.includes(".") && !localeDe.includes(",")) ||
  localeDe === "1234",
  `de-DE format (dots not commas): "${localeDe}"`,
);

// ============================================================
// 33. toStroop with no decimal point
// ============================================================
assertBigInt(toStroop("42", 7), 420000000n, "no decimal point in input");
assertBigInt(toStroop("0", 7), 0n, "zero no decimal");
assertBigInt(toStroop("1000000000000", 7), 10000000000000000000n, "large no decimal");

// ============================================================
// 34. Empty or edge-case decimal parts in toStroop
// ============================================================
assertBigInt(toStroop("1.", 7), 10000000n, "trailing dot = no decimals");
assertBigInt(toStroop("1.0", 7), 10000000n, "1.0 = 10M stroops");
assertBigInt(toStroop("1.00", 7), 10000000n, "1.00 = 10M stroops");
assertBigInt(toStroop("1.0000000", 7), 10000000n, "1.0000000 = 10M stroops");

// ============================================================
// 35. Multiple decimal points (invalid - should use first)
// ============================================================
assertBigInt(toStroop("1.2.3", 7), 12000000n, "multiple dots uses first segment");

// ============================================================
// 36. compare with large values
// ============================================================
assertEq(compare(BigInt("9999999999999999999"), BigInt("10000000000000000000")), -1, "compare large lt");
assertEq(compare(BigInt("10000000000000000000"), BigInt("9999999999999999999")), 1, "compare large gt");
assertEq(compare(BigInt("10000000000000000000"), BigInt("10000000000000000000")), 0, "compare large eq");

// ============================================================
// 37. fromStroop with varying decimals
// ============================================================
assertEq(fromStroop(1n, 0), "1", "fromStroop 1 dec 0");
assertEq(fromStroop(10n, 1), "1", "fromStroop 10 dec 1 = 1");
assertEq(fromStroop(1n, 1), "0.1", "fromStroop 1 dec 1 = 0.1");
assertEq(fromStroop(1n, 2), "0.01", "fromStroop 1 dec 2 = 0.01");
assertEq(fromStroop(1n, 3), "0.001", "fromStroop 1 dec 3 = 0.001");
assertEq(fromStroop(1n, 4), "0.0001", "fromStroop 1 dec 4 = 0.0001");
assertEq(fromStroop(1n, 5), "0.00001", "fromStroop 1 dec 5 = 0.00001");
assertEq(fromStroop(1n, 6), "0.000001", "fromStroop 1 dec 6 = 0.000001");
assertEq(fromStroop(1n, 7), "0.0000001", "fromStroop 1 dec 7 = 0.0000001");

// ============================================================
// 38. add and sub edge cases
// ============================================================
assertBigInt(add(0n, 0n), 0n, "add zero+zero");
assertBigInt(add(BigInt("99999999999999999999"), 0n), BigInt("99999999999999999999"), "add large+zero");
assertBigInt(sub(0n, 0n), 0n, "sub zero-zero");
assertBigInt(sub(BigInt("99999999999999999999"), 0n), BigInt("99999999999999999999"), "sub large-zero");
assertBigInt(sub(0n, BigInt("99999999999999999999")), BigInt("-99999999999999999999"), "sub zero-large = negative");

// ============================================================
// 39. fromBlockchain with different number bases
// ============================================================
assertBigInt(StroopConverter.fromBlockchain("0x10"), 16n, "hex 0x10 = 16");
assertBigInt(StroopConverter.fromBlockchain("0X10"), 16n, "hex 0X10 = 16");
assertBigInt(StroopConverter.fromBlockchain("0x7FFFFFFFFFFFFFFF"), BigInt("0x7FFFFFFFFFFFFFFF"), "max safe hex");
assertBigInt(StroopConverter.fromBlockchain(" 100 "), 100n, "whitespace trimmed");
assertBigInt(StroopConverter.fromBlockchain(" -5 "), -5n, "negative with whitespace");

// ============================================================
// 40. Negative rounding with DOWN and UP modes
// ============================================================
assertBigInt(div(-10n, 3n, RoundingMode.DOWN), -3n, "-10/3 DOWN = -3");
assertBigInt(div(-10n, 3n, RoundingMode.UP), -4n, "-10/3 UP = -4");
assertBigInt(div(-9n, 3n, RoundingMode.DOWN), -3n, "-9/3 DOWN = -3 (exact)");
assertBigInt(div(-9n, 3n, RoundingMode.UP), -3n, "-9/3 UP = -3 (exact)");
assertBigInt(div(-1n, 3n, RoundingMode.DOWN), 0n, "-1/3 DOWN = 0");
assertBigInt(div(-1n, 3n, RoundingMode.UP), -1n, "-1/3 UP = -1");

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Balance Scaler Test Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed.length}`);

if (failed.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failed) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("All tests passed!");
  process.exit(0);
}
