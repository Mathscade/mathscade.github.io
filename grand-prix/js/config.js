/* =====================================================================
   CONFIG: every balancing number in one place.
   World units are real metres and seconds, so 1 game unit = 1 metre.
   Change values here to rebalance the game without touching the systems.
   ===================================================================== */
window.F1 = window.F1 || {};

F1.CONFIG = {
  MAX_PLAYERS: 32,
  TICK: 1 / 60,                    // server simulation step (s)

  CAR: {
    length: 5.6, width: 2.6,       // drawn and collided size (m), matching the 3D car model
    maxSpeed: 92,                  // m/s on a straight (331 km/h)
    accel: 16,                     // m/s² from a standstill, tapering towards top speed
    brake: 40,                     // m/s² of braking
    reverseMax: 7,
    coast: 1.6,                    // m/s² rolling resistance with no throttle
    latGrip: 36,                   // m/s² of sideways grip before the car slides
    steerLat: 40,                  // how hard the driver can ask the car to turn (m/s²); above latGrip the car slides and scrubs speed
    yawMaxLow: 2.3,                // rad/s turning rate at walking pace
    scrub: 0.55,                   // share of excess sideways demand that turns into lost speed
  },

  SURFACE: {                       // grip and top-speed multipliers away from the asphalt
    kerb:   { grip: 0.95, top: 1.0,  drag: 0 },
    grass:  { grip: 0.55, top: 0.55, drag: 6 },
    gravel: { grip: 0.45, top: 0.38, drag: 14 },
  },

  PIT: {                           // the pit stop is where the maths happens
    questions: 10,                 // questions per stop (one per pit crew job)
    wrongPenalty: 3,               // seconds added for each wrong answer
    laneSpeed: 22,                 // pit lane speed limit (m/s, about 80 km/h)
    slotGap: 7,                    // metres between garage boxes
    boxBeforeLine: 30,             // the nearest box is this far before the finish line
    entryLen: 120, exitAfter: 40, exitLen: 110,   // metres of pit entry / exit road
    nextQuestion: 0.7,             // pause after an answer before the next question
    perfectBoost: 3.5, goodBoost: 2,               // boost leaving the pits after 10/10 or 8+/10
  },

  DAMAGE: {
    // health (%) -> share of normal top speed; values in between are blended
    speedTable: [[100, 1.00], [75, 0.95], [50, 0.85], [25, 0.70], [10, 0.50]],
    critical: 10,                  // at or below this the car needs a maths repair
    criticalSpeedCap: 0.55,        // share of top speed until the next pit stop fixes it
    repairAmount: 45,              // health restored by a correct repair answer
    boostRepair: 6,                // small repair from any correct pit-wall answer while damaged
    wallPerMs: 1.1,                // damage % per m/s of impact speed into a wall (above wallFree)
    wallFree: 4,
    carPerMs: 0.6,                 // damage % per m/s of closing speed in a car-to-car hit (above carFree)
    carFree: 3.5,
    wrongRepairDelay: 1.5,         // seconds before a new repair question after a wrong answer
  },

  COLLISION: {
    restitution: 0.35,
    minor: 4, major: 11,           // closing speed (m/s) thresholds for minor / medium / major hits
    spinOnMajor: 2.2,              // rad/s of random spin on a major hit
    ghostAfterReset: 2.0,          // seconds a reset car can't be hit
  },

  MATHS: {
    boostTime: 2.5, fastBoostTime: 3.6, fastAnswer: 4,   // seconds
    boostTop: 0.10, boostAccel: 0.45,                    // +10% top speed, +45% acceleration
    streakAccel: 0.06, streakMax: 5,                     // extra acceleration per answer in a streak
    nextDelay: 0.9,                                      // pause after an answer before the next question
  },

  ITEMS: {
    respawn: 8,                    // seconds before an item box comes back
    oilDuration: 20,               // seconds an oil slick stays on track
    oilRadius: 2.6,
    oilSlideTime: 1.3, oilSpeedLoss: 0.25, oilSpin: 4.2,
    ownerImmune: 1.2,              // a car can't slip on its own slick straight after dropping it
    randomOilPerMinute: 0.35,      // chance a stray slick appears on track each minute
    slipstreamRange: 22, slipstreamGain: 0.04,
  },

  TRACK_LIMITS: {
    cutTolerance: 6,               // metres of free gain allowed while off the track
    resetGain: 45,                 // metres gained by a cut that sends the car back
    penaltyTime: 2.5,              // seconds of reduced power after a corner cut
    penaltyCap: 0.55,
    stuckTime: 4,                  // seconds stopped off track before an automatic reset
  },

  RACE: {
    lapChoices: [1, 2, 3],         // laps the teacher can pick (two pit stops per lap: half way and at the end)
    studentPace: 1.32,             // a typical student lap is about this much slower than an ideal lap
    gateSpacing: 140,              // metres between invisible checkpoint gates
  },

  INTENSITY: { low: 0.55, normal: 1, high: 1.6 },
  ITEM_FREQ:  { low: 0.5, normal: 1, high: 1.7 },

  VIEW: {
    zoomBase: 9.5,                 // pixels per metre at low speed on a 900 px tall screen
    zoomFast: 0.66,                // zoom multiplier at top speed
  },
};
