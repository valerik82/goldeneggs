const START_BALANCE = 1000;
const MIN_BET = 1;
const MAX_BET_FRACTION = 0.6;
const SLOT_X = [17, 50, 83];

const state = {
  balance: START_BALANCE,
  bet: 50,
  selectedChickCount: 1,
  phase: "idle", // idle | shuffling | picking | reveal
  mapping: [0, 1, 2], // slot -> eggId
  roundResult: null, // { eggsWithChick:Set, multiplier:number }
};

const balanceDisplay = document.getElementById("balanceDisplay");
const betInput = document.getElementById("betInput");
const halfBetBtn = document.getElementById("halfBetBtn");
const doubleBetBtn = document.getElementById("doubleBetBtn");
const maxBetBtn = document.getElementById("maxBetBtn");
const oneChickBtn = document.getElementById("oneChickBtn");
const twoChickBtn = document.getElementById("twoChickBtn");
const playBtn = document.getElementById("playBtn");
const statusText = document.getElementById("statusText");
const eggButtons = [...document.querySelectorAll(".egg-slot")];
const startScreen = document.getElementById("startScreen");
const startNowBtn = document.getElementById("startNowBtn");

const audioCtx = createAudioContext();
updateUI();
resetEggVisuals();

halfBetBtn.addEventListener("click", () => adjustBet(Math.floor(sanitizedBet() / 2)));
doubleBetBtn.addEventListener("click", () => adjustBet(Math.floor(sanitizedBet() * 2)));
maxBetBtn.addEventListener("click", () => {
  const cap = Math.max(MIN_BET, Math.floor(state.balance * MAX_BET_FRACTION));
  adjustBet(cap);
});

betInput.addEventListener("input", () => adjustBet(Number(betInput.value), false));
oneChickBtn.addEventListener("click", () => setChickMode(1));
twoChickBtn.addEventListener("click", () => setChickMode(2));
startNowBtn.addEventListener("click", onStartGame);

playBtn.addEventListener("click", async () => {
  if (state.phase !== "idle") return;
  const bet = sanitizedBet();

  if (bet > state.balance) {
    setStatus("Not enough coins for that bet.", "lose");
    return;
  }
  if (bet < MIN_BET) {
    setStatus("Minimum bet is 1 coin.", "lose");
    return;
  }

  state.bet = bet;
  state.balance -= bet;
  updateUI();
  state.phase = "shuffling";
  disableControls(true);
  resetEggVisuals();
  resetEggPositions();

  state.roundResult = generateRoundResult();
  await previewChicksBeforeShuffle();
  setStatus("Shuffling eggs...", "");
  await shuffleEggs();

  state.phase = "picking";
  eggButtons.forEach((egg) => egg.classList.add("selectable"));
  setStatus("Pick an egg!", "");
});

eggButtons.forEach((btn, slotIndex) => {
  btn.style.left = `${SLOT_X[slotIndex]}%`;
  btn.addEventListener("click", () => onPick(slotIndex));
});

function onPick(slotIndex) {
  if (state.phase !== "picking") return;
  state.phase = "reveal";
  eggButtons.forEach((egg) => egg.classList.remove("selectable"));

  const pickedEggId = state.mapping[slotIndex];
  const isWin = state.roundResult.eggsWithChick.has(pickedEggId);
  const multiplier = isWin ? state.roundResult.multiplier : 0;
  const winAmount = Math.floor(state.bet * multiplier);

  revealEgg(slotIndex, isWin);
  if (isWin) {
    state.balance += winAmount;
    setStatus(`Chick found! x${multiplier.toFixed(1)}  +${winAmount} coins`, "win");
    playHatch();
  } else {
    setStatus("No chick. Better luck next round!", "lose");
    playLose();
  }
  updateUI();

  setTimeout(() => {
    disableControls(false);
    state.phase = "idle";
    setStatus("Set your bet and press Play.", "");
    resetEggVisuals();
  }, 1400);
}

function generateRoundResult() {
  const chickCount = state.selectedChickCount;
  const multiplier = chickCount === 1 ? 3.4 : 1.8;

  const pool = [0, 1, 2];
  const eggsWithChick = new Set();
  while (eggsWithChick.size < chickCount) {
    const idx = Math.floor(Math.random() * pool.length);
    eggsWithChick.add(pool[idx]);
    pool.splice(idx, 1);
  }
  return { eggsWithChick, multiplier };
}

async function shuffleEggs() {
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const speedUp = i < 8;
    const delay = speedUp ? 180 - i * 12 : 76 + (i - 8) * 23;
    const [a, b] = twoDistinctIndices();
    [state.mapping[a], state.mapping[b]] = [state.mapping[b], state.mapping[a]];
    animateToMapping(delay * 0.9);
    playShuffleTone(1 + i * 0.05);
    await wait(delay);
  }
}

async function previewChicksBeforeShuffle() {
  setStatus("Watch closely! Chick position is shown...", "");
  eggButtons.forEach((egg, eggId) => {
    const chick = egg.querySelector(".chick");
    chick.classList.remove("show", "hide");
    chick.classList.add(state.roundResult.eggsWithChick.has(eggId) ? "show" : "hide");
  });
  await wait(900);
  eggButtons.forEach((egg) => {
    const chick = egg.querySelector(".chick");
    chick.classList.remove("show", "hide");
  });
  await wait(220);
}

function animateToMapping(durationMs) {
  for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
    const eggId = state.mapping[slotIndex];
    const egg = eggButtons[eggId];
    egg.style.transition = `left ${durationMs}ms cubic-bezier(0.25, 0.9, 0.3, 1)`;
    egg.style.left = `${SLOT_X[slotIndex]}%`;
  }
}

function resetEggPositions() {
  state.mapping = [0, 1, 2];
  for (let eggId = 0; eggId < 3; eggId++) {
    const egg = eggButtons[eggId];
    egg.style.transition = "left 140ms ease";
    egg.style.left = `${SLOT_X[eggId]}%`;
  }
}

function revealEgg(slotIndex, hasChick) {
  const egg = eggButtons.find((b) => Number(b.dataset.slot) === slotIndex);
  if (!egg) return;

  egg.classList.add("reveal");
  const chick = egg.querySelector(".chick");
  chick.classList.remove("show", "hide");
  chick.classList.add(hasChick ? "show" : "hide");

  playTap();
}

function resetEggVisuals() {
  eggButtons.forEach((egg) => {
    egg.classList.remove("reveal", "selectable");
    const chick = egg.querySelector(".chick");
    chick.classList.remove("show", "hide");
    egg.style.transition = "left 220ms ease";
  });
}

function disableControls(disabled) {
  playBtn.disabled = disabled;
  halfBetBtn.disabled = disabled;
  doubleBetBtn.disabled = disabled;
  maxBetBtn.disabled = disabled;
  oneChickBtn.disabled = disabled;
  twoChickBtn.disabled = disabled;
  betInput.disabled = disabled;
}

function setStatus(msg, mode) {
  statusText.textContent = msg;
  statusText.classList.remove("win", "lose");
  if (mode) statusText.classList.add(mode);
}

function adjustBet(value, syncInput = true) {
  if (state.phase !== "idle") return;
  const safeValue = Math.max(MIN_BET, Math.floor(Number.isFinite(value) ? value : MIN_BET));
  const cap = Math.max(MIN_BET, Math.floor(state.balance * MAX_BET_FRACTION)) || MIN_BET;
  state.bet = Math.min(safeValue, cap);
  if (syncInput) betInput.value = String(state.bet);
  else if (Number(betInput.value) !== state.bet) betInput.value = String(state.bet);
}

function sanitizedBet() {
  const raw = Number(betInput.value);
  return Math.max(MIN_BET, Math.floor(Number.isFinite(raw) ? raw : state.bet));
}

function updateUI() {
  balanceDisplay.textContent = String(state.balance);
  const cap = Math.max(MIN_BET, Math.floor(state.balance * MAX_BET_FRACTION)) || MIN_BET;
  betInput.max = String(cap);
  if (state.bet > cap) {
    state.bet = cap;
    betInput.value = String(cap);
  }
  oneChickBtn.classList.toggle("active", state.selectedChickCount === 1);
  oneChickBtn.setAttribute("aria-pressed", String(state.selectedChickCount === 1));
  twoChickBtn.classList.toggle("active", state.selectedChickCount === 2);
  twoChickBtn.setAttribute("aria-pressed", String(state.selectedChickCount === 2));
}

function setChickMode(chickCount) {
  if (state.phase !== "idle") return;
  state.selectedChickCount = chickCount === 2 ? 2 : 1;
  setStatus(`Mode: ${state.selectedChickCount} chick${state.selectedChickCount === 1 ? "" : "s"} per round`, "");
  updateUI();
}

function twoDistinctIndices() {
  const a = Math.floor(Math.random() * 3);
  let b = Math.floor(Math.random() * 3);
  if (b === a) b = (b + 1) % 3;
  return [a, b];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAudioContext() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone({ freq = 440, duration = 0.08, type = "sine", gain = 0.05, slideTo }) {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playShuffleTone(scale = 1) {
  playTone({ freq: 300 * scale, duration: 0.06, type: "triangle", gain: 0.045, slideTo: 240 * scale });
}

function playTap() {
  playTone({ freq: 560, duration: 0.05, type: "square", gain: 0.03, slideTo: 480 });
}

function playHatch() {
  playTone({ freq: 540, duration: 0.09, type: "triangle", gain: 0.045, slideTo: 690 });
  setTimeout(() => playTone({ freq: 700, duration: 0.12, type: "sine", gain: 0.05, slideTo: 910 }), 70);
}

function playLose() {
  playTone({ freq: 240, duration: 0.14, type: "sawtooth", gain: 0.03, slideTo: 140 });
}

function onStartGame() {
  startScreen.classList.add("hidden");
  playTap();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}
