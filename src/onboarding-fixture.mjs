const clone = (value) => JSON.parse(JSON.stringify(value));

const INITIAL_BOARD = [
  0, 0, 0, 2, 2, 2,
  1, 1, 1, 3, 3, 3,
  4, 4, 4, 4, 4, 4,
  0, 0, 0, 1, 1, 1,
  2, 2, 2, 3, 3, 3,
  4, 4, 4, 0, 0, 0,
  1, 1, 1, 2, 2, 2
];

const cell = (row, column) => ({ row, column });

const STEPS = [
  {
    id: "companion-a-first-route",
    cat: "A",
    target: "Connect at least three matching tiles",
    candidates: [[cell(0, 0), cell(0, 1), cell(0, 2)]]
  },
  {
    id: "companion-b-first-meeting",
    cat: "B",
    target: "End on a tile from the previous route",
    candidates: [[cell(1, 0), cell(1, 1), cell(0, 1)]]
  },
  {
    id: "choose-long-or-meeting",
    cat: "A",
    target: "Choose a long route or make a rendezvous",
    candidates: [
      [cell(2, 0), cell(2, 1), cell(2, 2), cell(2, 3), cell(2, 4), cell(2, 5)],
      [cell(0, 3), cell(0, 2), cell(0, 1)]
    ]
  }
];

// The first six values make the first two authoritative steps produce the
// fixed third-step choice. Remaining values keep calibration deterministic.
const REFILL_SEQUENCE = [
  1, 1, 2, 2, 2, 2,
  0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3,
  4, 4, 4, 0, 0, 0, 1, 1, 1, 2, 2, 2,
  3, 3, 3, 4, 4, 4, 0, 0, 0, 1, 1, 1,
  2, 2, 2, 3, 3, 3, 4, 4, 4, 0, 0, 0,
  1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4
];

// These routes replay after choosing the third tutorial step's meeting option.
// The first two both meet the previous route, proving the calibration target
// is reachable without test-only board edits.
const CALIBRATION_ROUTES = [
  [cell(0, 1), cell(0, 2), cell(0, 3)],
  [cell(0, 0), cell(0, 1), cell(1, 2), cell(0, 3)],
  [cell(0, 0), cell(1, 1), cell(1, 2)],
  [cell(0, 3), cell(1, 4), cell(1, 5)],
  [cell(0, 3), cell(1, 4), cell(2, 5)],
  [cell(0, 3), cell(1, 4), cell(1, 5)],
  [cell(0, 2), cell(0, 3), cell(1, 4)],
  [cell(0, 1), cell(0, 2), cell(0, 3)]
];

export function createOnboardingFixture() {
  return clone({
    id: "three-minute-v1",
    initialBoard: INITIAL_BOARD,
    steps: STEPS,
    calibrationRoutes: CALIBRATION_ROUTES,
    refillSequence: REFILL_SEQUENCE,
    randomCursor: 0
  });
}

export function sameRoute(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((item, index) => item.row === right[index].row && item.column === right[index].column);
}
