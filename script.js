const form = document.querySelector("#bracket-form");
const setupView = document.querySelector("#setup-view");
const bracketView = document.querySelector("#bracket-view");
const rangeInput = document.querySelector("#team-count-range");
const numberInput = document.querySelector("#team-count-input");
const teamsInput = document.querySelector("#teams-input");
const teamCounter = document.querySelector("#team-counter");
const formMessage = document.querySelector("#form-message");
const fillDemoButton = document.querySelector("#fill-demo");
const editBracketButton = document.querySelector("#edit-bracket");
const bracketRoot = document.querySelector("#bracket");
const championBanner = document.querySelector("#champion-banner");
const confettiLayer = document.querySelector("#confetti-layer");

const summaryTeams = document.querySelector("#summary-teams");
const summaryByes = document.querySelector("#summary-byes");
const summaryRounds = document.querySelector("#summary-rounds");
const summaryMatchups = document.querySelector("#summary-matchups");
const summaryDecided = document.querySelector("#summary-decided");
const summaryChampion = document.querySelector("#summary-champion");

const MAX_TEAMS = 512;

let bracketState = null;
let confettiBurstShown = false;
let lastChampionLabel = null;

function clampTeamCount(value) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return 3;
  }

  return Math.min(MAX_TEAMS, Math.max(3, number));
}

function parseTeams(input) {
  return input
    .split(",")
    .map((team) => team.trim())
    .filter(Boolean);
}

function syncCount(value) {
  const teamCount = clampTeamCount(value);
  rangeInput.value = String(teamCount);
  numberInput.value = String(teamCount);
  updateTeamCounter();
  return teamCount;
}

function updateTeamCounter() {
  const teams = parseTeams(teamsInput.value);
  const selectedCount = clampTeamCount(numberInput.value);
  const difference = selectedCount - teams.length;
  const seedingNote =
    teams.length > 0 ? ` Seed order follows the list exactly.` : "";

  if (difference === 0) {
    teamCounter.textContent = `${teams.length} teams detected.${seedingNote}`;
    return;
  }

  if (difference > 0) {
    teamCounter.textContent = `${teams.length} teams detected. Add ${difference} more.${seedingNote}`;
    return;
  }

  teamCounter.textContent = `${teams.length} teams detected. Remove ${Math.abs(difference)}.${seedingNote}`;
}

function setMessage(message, state) {
  formMessage.textContent = message;
  formMessage.dataset.state = state;
}

function highestPowerOfTwoAtMost(value) {
  let power = 1;
  while (power * 2 <= value) {
    power *= 2;
  }
  return power;
}

function seedOrder(size) {
  if (size === 1) {
    return [1];
  }

  const previous = seedOrder(size / 2);
  const mirrored = previous.map((seed) => size + 1 - seed);
  const order = [];

  previous.forEach((seed, index) => {
    order.push(seed, mirrored[index]);
  });

  return order;
}

function createEntry(team) {
  if (!team) {
    return { type: "bye", label: "Bye", seed: null };
  }

  return {
    type: "team",
    label: team.name,
    seed: team.seed,
  };
}

function createPlaceholder() {
  return {
    type: "tbd",
    label: "TBD",
    seed: null,
  };
}

function entriesMatch(left, right) {
  return left.type === right.type && left.label === right.label && left.seed === right.seed;
}

function cloneEntry(entry) {
  return {
    type: entry.type,
    label: entry.label,
    seed: entry.seed,
  };
}

function buildBracketState(teams) {
  const seededTeams = teams.map((name, index) => ({
    name,
    seed: index + 1,
  }));

  const baseSize = highestPowerOfTwoAtMost(seededTeams.length);
  const playInMatchCount = seededTeams.length - baseSize;
  const byeCount = playInMatchCount === 0 ? 0 : seededTeams.length - playInMatchCount * 2;
  const rounds = [];

  if (playInMatchCount === 0) {
    let currentRoundEntries = seedOrder(seededTeams.length).map((seed) =>
      createEntry(seededTeams[seed - 1])
    );
    let currentSize = currentRoundEntries.length;

    while (currentSize >= 2) {
      const roundIndex = rounds.length;
      const matches = [];
      const nextEntries = new Array(currentSize / 2).fill(null).map(() => createPlaceholder());

      for (let index = 0; index < currentRoundEntries.length; index += 2) {
        const slot = index / 2;
        const top = currentRoundEntries[index];
        const bottom = currentRoundEntries[index + 1];

        matches.push({
          id: `r${roundIndex}-m${slot}`,
          roundIndex,
          matchIndex: slot,
          sides: [top, bottom],
          initialSides: [cloneEntry(top), cloneEntry(bottom)],
          winnerSide: null,
          nextMatchIndex: currentSize > 2 ? Math.floor(slot / 2) : null,
          nextSideIndex: currentSize > 2 ? slot % 2 : null,
        });
      }

      rounds.push(matches);
      currentRoundEntries = nextEntries;
      currentSize /= 2;
    }
  } else {
    const protectedSeedCutoff = byeCount;
    const mainSeeds = seedOrder(baseSize);
    const mainRoundEntries = mainSeeds.map((seed) =>
      seed <= protectedSeedCutoff ? createEntry(seededTeams[seed - 1]) : createPlaceholder()
    );
    const playInMatches = [];

    for (let index = 0; index < playInMatchCount; index += 1) {
      const seededPlayInSeed = baseSize - index;
      const extraSeed = baseSize + 1 + index;
      const targetSlotIndex = mainSeeds.indexOf(seededPlayInSeed);

      playInMatches.push({
        id: `r0-m${index}`,
        roundIndex: 0,
        matchIndex: index,
        sides: [
          createEntry(seededTeams[seededPlayInSeed - 1]),
          createEntry(seededTeams[extraSeed - 1]),
        ],
        initialSides: [
          createEntry(seededTeams[seededPlayInSeed - 1]),
          createEntry(seededTeams[extraSeed - 1]),
        ],
        winnerSide: null,
        nextMatchIndex: Math.floor(targetSlotIndex / 2),
        nextSideIndex: targetSlotIndex % 2,
      });
    }

    rounds.push(playInMatches);

    let currentRoundEntries = mainRoundEntries;
    let currentSize = currentRoundEntries.length;

    while (currentSize >= 2) {
      const roundIndex = rounds.length;
      const matches = [];
      const nextEntries = new Array(currentSize / 2).fill(null).map(() => createPlaceholder());

      for (let index = 0; index < currentRoundEntries.length; index += 2) {
        const slot = index / 2;
        const top = currentRoundEntries[index];
        const bottom = currentRoundEntries[index + 1];

        matches.push({
          id: `r${roundIndex}-m${slot}`,
          roundIndex,
          matchIndex: slot,
          sides: [top, bottom],
          initialSides: [cloneEntry(top), cloneEntry(bottom)],
          winnerSide: null,
          nextMatchIndex: currentSize > 2 ? Math.floor(slot / 2) : null,
          nextSideIndex: currentSize > 2 ? slot % 2 : null,
        });
      }

      rounds.push(matches);
      currentRoundEntries = nextEntries;
      currentSize /= 2;
    }
  }

  const state = {
    teamCount: seededTeams.length,
    byeCount,
    rounds,
  };

  propagateWinners(state);
  return state;
}

function propagateWinners(state) {
  const previousRounds = state.rounds.map((round) =>
    round.map((match) => ({
      sides: match.sides.map(cloneEntry),
      winnerSide: match.winnerSide,
    }))
  );

  for (let roundIndex = 1; roundIndex < state.rounds.length; roundIndex += 1) {
    state.rounds[roundIndex].forEach((match) => {
      match.sides = match.initialSides.map(cloneEntry);
      match.winnerSide = null;
    });
  }

  for (let roundIndex = 0; roundIndex < state.rounds.length - 1; roundIndex += 1) {
    state.rounds[roundIndex].forEach((match) => {
      if (match.winnerSide === null) {
        return;
      }

      const winner = match.sides[match.winnerSide];
      if (!winner || winner.type !== "team") {
        return;
      }

      const nextMatch = state.rounds[roundIndex + 1][match.nextMatchIndex];
      nextMatch.sides[match.nextSideIndex] = { ...winner };
    });

    state.rounds[roundIndex + 1].forEach((match) => {
      const [top, bottom] = match.sides;
      const previousMatch = previousRounds[roundIndex + 1][match.matchIndex];

      if (
        previousMatch &&
        entriesMatch(previousMatch.sides[0], top) &&
        entriesMatch(previousMatch.sides[1], bottom) &&
        previousMatch.winnerSide !== null
      ) {
        match.winnerSide = previousMatch.winnerSide;
      }
    });
  }
}

function describeRound(roundIndex, roundCount) {
  if (roundCount === 1) {
    return "Championship";
  }

  if (roundIndex === 0 && bracketState.byeCount > 0) {
    return "Play-In Round";
  }

  if (roundIndex === roundCount - 1) {
    return "Championship";
  }

  if (roundIndex === roundCount - 2) {
    return "Semifinals";
  }

  if (roundIndex === roundCount - 3) {
    return "Quarterfinals";
  }

  return `Round ${roundIndex + 1}`;
}

function getEntryState(match, sideIndex) {
  const entry = match.sides[sideIndex];

  if (entry.type === "bye") {
    return "bye";
  }

  if (entry.type === "tbd") {
    return "tbd";
  }

  if (match.winnerSide === sideIndex) {
    return match.roundIndex === 0 && match.sides[1 - sideIndex].type === "bye"
      ? "locked-winner"
      : "winner";
  }

  if (match.winnerSide !== null) {
    return "loser";
  }

  return "team";
}

function isSelectable(match, sideIndex) {
  const entry = match.sides[sideIndex];
  const opponent = match.sides[1 - sideIndex];

  if (entry.type !== "team") {
    return false;
  }

  if (opponent.type !== "team") {
    return false;
  }

  return true;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSeedLabel(entry) {
  if (entry.type === "bye") {
    return "Automatic bye";
  }

  if (entry.type === "tbd") {
    return "Waiting";
  }

  return `Seed ${entry.seed}`;
}

function renderSeedButton(match, sideIndex) {
  const entry = match.sides[sideIndex];
  const state = getEntryState(match, sideIndex);
  const selected = match.winnerSide === sideIndex ? "true" : "false";
  const disabled = isSelectable(match, sideIndex) ? "" : "disabled";

  return `
    <button
      class="seed-button"
      type="button"
      data-action="pick-winner"
      data-round-index="${match.roundIndex}"
      data-match-index="${match.matchIndex}"
      data-side-index="${sideIndex}"
      data-state="${state}"
      aria-pressed="${selected}"
      ${disabled}
    >
      <span class="seed-meta">${getSeedLabel(entry)}</span>
      <span class="seed-name">${escapeHtml(entry.label)}</span>
    </button>
  `;
}

function getMatchNote(match) {
  const [top, bottom] = match.sides;

  if (top.type === "bye" || bottom.type === "bye") {
    return "Automatic advance";
  }

  if (top.type === "tbd" || bottom.type === "tbd") {
    return "Waiting for earlier result";
  }

  if (match.winnerSide !== null) {
    return "Winner selected";
  }

  return "Choose a winner";
}

function ensureBracketLinesLayer() {
  let svg = bracketRoot.querySelector(".bracket-lines");
  if (svg) {
    return svg;
  }

  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("bracket-lines");
  svg.setAttribute("aria-hidden", "true");
  bracketRoot.prepend(svg);
  return svg;
}

function drawBracketLines() {
  if (!bracketState) {
    return;
  }

  const svg = ensureBracketLinesLayer();
  const bracketRect = bracketRoot.getBoundingClientRect();
  const width = Math.ceil(bracketRoot.scrollWidth);
  const height = Math.ceil(bracketRoot.scrollHeight);

  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const lineColor = "rgba(25, 143, 118, 0.42)";
  const lineWidth = 3;

  bracketState.rounds.forEach((round, roundIndex) => {
    if (roundIndex >= bracketState.rounds.length - 1) {
      return;
    }

    round.forEach((match) => {
      if (match.nextMatchIndex === null) {
        return;
      }

      const currentElement = bracketRoot.querySelector(
        `.match[data-round-index="${roundIndex}"][data-match-index="${match.matchIndex}"]`
      );
      const nextElement = bracketRoot.querySelector(
        `.match[data-round-index="${roundIndex + 1}"][data-match-index="${match.nextMatchIndex}"]`
      );

      if (!currentElement || !nextElement) {
        return;
      }

      const currentRect = currentElement.getBoundingClientRect();
      const nextRect = nextElement.getBoundingClientRect();
      const startX = currentRect.right - bracketRect.left;
      const startY = currentRect.top - bracketRect.top + currentRect.height / 2;
      const endX = nextRect.left - bracketRect.left;
      const endY = nextRect.top - bracketRect.top + nextRect.height / 2;
      const midX = startX + (endX - startX) / 2;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", lineColor);
      path.setAttribute("stroke-width", String(lineWidth));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
    });
  });
}

function updateBracketLayout() {
  if (!bracketState) {
    return;
  }

  const roundElements = [...bracketRoot.querySelectorAll(".round")];
  if (roundElements.length === 0) {
    return;
  }

  const firstRoundMatches = [...roundElements[0].querySelectorAll(".match")];
  if (firstRoundMatches.length === 0) {
    return;
  }

  const firstRoundList = roundElements[0].querySelector(".match-list");
  const computedListStyle = window.getComputedStyle(firstRoundList);
  const baseGap = Number.parseFloat(computedListStyle.rowGap) || 16;
  const baseMatchHeight = Math.max(
    ...firstRoundMatches.map((matchElement) => matchElement.getBoundingClientRect().height)
  );
  const step = baseMatchHeight + baseGap;

  bracketRoot.style.setProperty("--match-height", `${baseMatchHeight}px`);

  roundElements.forEach((roundElement, roundIndex) => {
    const matchList = roundElement.querySelector(".match-list");
    if (!matchList) {
      return;
    }

    if (roundIndex === 0) {
      roundElement.style.setProperty("--round-gap", `${baseGap}px`);
      roundElement.style.removeProperty("--round-offset");
      return;
    }

    const multiplier = 2 ** roundIndex;
    const offset = ((multiplier - 1) * step) / 2;
    const gap = multiplier * step - baseMatchHeight;

    roundElement.style.setProperty("--round-offset", `${offset}px`);
    roundElement.style.setProperty("--round-gap", `${gap}px`);
  });

  drawBracketLines();
}

function renderBracket() {
  const roundCount = bracketState.rounds.length;

  bracketRoot.innerHTML = bracketState.rounds
    .map((round, roundIndex) => {
      const title = describeRound(roundIndex, roundCount);

      return `
        <section class="round" data-round-index="${roundIndex}">
          <div class="round-header">
            <h3>${title}</h3>
            <p>${round.length} matchup${round.length === 1 ? "" : "s"}</p>
          </div>
          <div class="match-list">
            ${round
              .map(
                (match) => `
                  <article
                    class="match"
                    data-round-index="${roundIndex}"
                    data-match-index="${match.matchIndex}"
                  >
                    <div class="match-head">
                      <strong>Match ${match.matchIndex + 1}</strong>
                      <span class="match-note">${getMatchNote(match)}</span>
                    </div>
                    ${renderSeedButton(match, 0)}
                    ${renderSeedButton(match, 1)}
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");

  updateBracketLayout();
  updateSummary();
}

function getChampion() {
  const championship = bracketState.rounds[bracketState.rounds.length - 1][0];
  if (championship.winnerSide === null) {
    return null;
  }

  const winner = championship.sides[championship.winnerSide];
  return winner.type === "team" ? winner : null;
}

function updateSummary() {
  const firstRoundCompetitiveMatches = bracketState.rounds[0].filter((match) => {
    const [top, bottom] = match.sides;
    return top.type === "team" && bottom.type === "team";
  }).length;
  const selectedMatches = bracketState.rounds.reduce(
    (count, round) =>
      count +
      round.filter((match) => {
        const [top, bottom] = match.sides;
        return top.type === "team" && bottom.type === "team" && match.winnerSide !== null;
      }).length,
    0
  );

  const champion = getChampion();

  summaryTeams.textContent = String(bracketState.teamCount);
  summaryByes.textContent = String(bracketState.byeCount);
  summaryRounds.textContent = String(bracketState.rounds.length);
  summaryMatchups.textContent = String(firstRoundCompetitiveMatches);
  summaryDecided.textContent = String(selectedMatches);
  summaryChampion.textContent = champion ? champion.label : "TBD";

  if (champion) {
    championBanner.textContent = `${champion.label} wins the tournament.`;
    championBanner.classList.remove("hidden");

    if (!confettiBurstShown || champion.label !== lastChampionLabel) {
      launchConfetti();
      confettiBurstShown = true;
    }
    lastChampionLabel = champion.label;
  } else {
    championBanner.textContent = "";
    championBanner.classList.add("hidden");
    confettiBurstShown = false;
    lastChampionLabel = null;
  }
}

function launchConfetti() {
  const colors = ["#bf5a36", "#f2c14e", "#527431", "#2d6a8a", "#ffffff"];

  confettiLayer.innerHTML = "";

  Array.from({ length: 120 }, (_, index) => {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 250}ms`;
    piece.style.setProperty("--drift-x", `${(Math.random() - 0.5) * 320}px`);
    piece.style.setProperty("--spin", `${Math.random() * 960 - 480}deg`);
    confettiLayer.append(piece);
  });

  window.setTimeout(() => {
    confettiLayer.innerHTML = "";
  }, 2200);
}

function selectWinner(roundIndex, matchIndex, sideIndex) {
  const match = bracketState.rounds[roundIndex][matchIndex];
  if (!isSelectable(match, sideIndex)) {
    return;
  }

  match.winnerSide = sideIndex;
  propagateWinners(bracketState);
  renderBracket();
}

function showBracketView() {
  setupView.classList.add("hidden");
  bracketView.classList.remove("hidden");
}

function showSetupView() {
  bracketView.classList.add("hidden");
  setupView.classList.remove("hidden");
}

function generateDemoTeams() {
  const teamCount = clampTeamCount(numberInput.value);
  const demoTeams = Array.from({ length: teamCount }, (_, index) => `Team ${index + 1}`);
  teamsInput.value = demoTeams.join(", ");
  updateTeamCounter();
}

rangeInput.addEventListener("input", (event) => {
  syncCount(event.target.value);
});

numberInput.addEventListener("input", (event) => {
  syncCount(event.target.value);
});

teamsInput.addEventListener("input", updateTeamCounter);

fillDemoButton.addEventListener("click", generateDemoTeams);

editBracketButton.addEventListener("click", () => {
  showSetupView();
});

bracketRoot.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="pick-winner"]');
  if (!button) {
    return;
  }

  selectWinner(
    Number.parseInt(button.dataset.roundIndex, 10),
    Number.parseInt(button.dataset.matchIndex, 10),
    Number.parseInt(button.dataset.sideIndex, 10)
  );
});

window.addEventListener("resize", updateBracketLayout);

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const teamCount = syncCount(numberInput.value);
  const teams = parseTeams(teamsInput.value);

  if (teams.length !== teamCount) {
    setMessage(
      `Expected ${teamCount} teams, but found ${teams.length}. Teams must be separated by commas.`,
      "error"
    );
    return;
  }

  const uniqueNames = new Set(teams.map((team) => team.toLowerCase()));
  if (uniqueNames.size !== teams.length) {
    setMessage("Team names must be unique so the bracket stays readable.", "error");
    return;
  }

  bracketState = buildBracketState(teams);
  confettiBurstShown = false;
  lastChampionLabel = null;
  renderBracket();
  showBracketView();
  setMessage("Bracket created successfully.", "success");
});

generateDemoTeams();
updateTeamCounter();
