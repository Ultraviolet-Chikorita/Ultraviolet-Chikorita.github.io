(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const PHASE_NAMES = [
    "",
    "I · The Witness",
    "II · The Assembly",
    "III · The Gaze Crown"
  ];
  const MAX_PLAYER_HEALTH = 24;
  const MAX_THREAD = 5;
  const DEFLECTOR_COOLDOWN = 0.42;
  const DEFLECTOR_PULSE = 0.2;
  const DEFLECTOR_RECOVERY = 1.05;
  const VICTORY_SPLINTER_AT = 4.75;
  const VICTORY_RESULTS_AT = 6.35;
  const VICTORY_DURATION = 8.2;

  function formatEncounterTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainder = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${minutes}:${remainder}`;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  function easeOutCubic(value) {
    const progress = clamp(value, 0, 1);
    return 1 - Math.pow(1 - progress, 3);
  }

  function distanceBetween(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function normalizeVector(x, y, fallbackX = 1, fallbackY = 0) {
    const distance = Math.hypot(x, y);
    if (!distance) {
      return { x: fallbackX, y: fallbackY };
    }
    return { x: x / distance, y: y / distance };
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) {
      return distanceBetween(point, start);
    }
    const projection = clamp(
      (
        (point.x - start.x) * dx +
        (point.y - start.y) * dy
      ) / lengthSquared,
      0,
      1
    );
    return Math.hypot(
      point.x - (start.x + dx * projection),
      point.y - (start.y + dy * projection)
    );
  }

  function circleIntersectsRect(circle, rect) {
    const closestX = clamp(circle.x, rect.left, rect.right);
    const closestY = clamp(circle.y, rect.top, rect.bottom);
    return Math.hypot(
      circle.x - closestX,
      circle.y - closestY
    ) <= circle.radius;
  }

  function segmentIntersectsRect(start, end, rect, padding = 0) {
    const expanded = {
      left: rect.left - padding,
      right: rect.right + padding,
      top: rect.top - padding,
      bottom: rect.bottom + padding
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let near = 0;
    let far = 1;

    for (const [origin, direction, minimum, maximum] of [
      [start.x, dx, expanded.left, expanded.right],
      [start.y, dy, expanded.top, expanded.bottom]
    ]) {
      if (Math.abs(direction) < 0.00001) {
        if (origin < minimum || origin > maximum) {
          return false;
        }
        continue;
      }
      const inverse = 1 / direction;
      let first = (minimum - origin) * inverse;
      let second = (maximum - origin) * inverse;
      if (first > second) {
        [first, second] = [second, first];
      }
      near = Math.max(near, first);
      far = Math.min(far, second);
      if (near > far) {
        return false;
      }
    }
    return true;
  }

  function polygonPath(context, points) {
    if (!points.length) {
      return;
    }
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
  }

  function createPip(container, className) {
    const pip = document.createElement("span");
    pip.className = className;
    container.appendChild(pip);
    return pip;
  }

  window.createEyeBossEncounter = function createEyeBossEncounter({
    stage,
    bossHealthFill,
    bossPhaseLabel,
    bossObjective,
    playerHealthPips,
    threadChargePips,
    onCue = () => {},
    onPhaseChange = () => {},
    onPlayerDeath = () => {},
    onCursorMode = () => {},
    onDeathMode = () => {},
    onVictoryMode = () => {},
    timerDisplay = null,
    heartsDisplay = null,
    resultTimeDisplay = null,
    resultHeartsDisplay = null,
    resultPanel = null
  }) {
    const state = {
      active: false,
      phase: 1,
      phaseHealth: 100,
      phaseTime: 0,
      transitionTime: 0,
      transitionPulse: 0,
      encounterElapsed: 0,
      heartsLost: 0,
      victoryTime: 0,
      resultShown: false,
      attackTimer: 1.4,
      patternIndex: 0,
      objective: "",
      wardOpen: false,
      anchorIndex: 0,
      anchorDelay: 0,
      player: {
        health: MAX_PLAYER_HEALTH,
        invulnerable: 0,
        hitFlash: 0,
        deathTimer: 0,
        attackCooldown: 0,
        rangedCooldown: 0,
        attackTime: 0,
        combo: 0,
        thread: MAX_THREAD,
        threadTimer: 0
      },
      pointer: {
        x: 0,
        y: 0,
        pulse: 0,
        cooldown: 0,
        radius: 45
      },
      minions: [],
      anchors: [],
      seals: [],
      debris: [],
      projectiles: [],
      playerShots: [],
      beams: [],
      zones: [],
      shockwaves: [],
      slashes: [],
      particles: [],
      victoryFragments: [],
      victoryRays: [],
      crackCues: [],
      splinterCuePlayed: false,
      platforms: [],
      assistedTarget: null,
      world: null,
      lastHudKey: ""
    };

    const healthPips = [];
    const threadPips = [];
    playerHealthPips.replaceChildren();
    threadChargePips.replaceChildren();
    for (let index = 0; index < MAX_PLAYER_HEALTH; index += 1) {
      healthPips.push(createPip(playerHealthPips, "player-health-pip"));
    }
    for (let index = 0; index < MAX_THREAD; index += 1) {
      threadPips.push(createPip(threadChargePips, "thread-charge-pip"));
    }

    function setObjective(text) {
      state.objective = text;
      bossObjective.textContent = text;
    }

    function updateHud(force = false) {
      if (timerDisplay) {
        timerDisplay.textContent = formatEncounterTime(state.encounterElapsed);
      }
      if (heartsDisplay) {
        heartsDisplay.textContent = `${state.heartsLost} LOST`;
      }
      const overallHealth = (
        (3 - state.phase) * 100 + clamp(state.phaseHealth, 0, 100)
      ) / 300;
      const hudKey = [
        state.phase,
        Math.round(state.phaseHealth),
        state.player.health,
        state.player.thread,
        state.objective
      ].join("|");
      if (!force && hudKey === state.lastHudKey) {
        return;
      }

      state.lastHudKey = hudKey;
      bossPhaseLabel.textContent = PHASE_NAMES[state.phase];
      bossHealthFill.style.setProperty(
        "--boss-health",
        clamp(overallHealth, 0, 1).toFixed(4)
      );
      healthPips.forEach((pip, index) => {
        pip.classList.toggle("is-empty", index >= state.player.health);
      });
      threadPips.forEach((pip, index) => {
        pip.classList.toggle("is-empty", index >= state.player.thread);
      });
      playerHealthPips.setAttribute(
        "aria-label",
        `${state.player.health} of ${MAX_PLAYER_HEALTH} vitality`
      );
      threadChargePips.setAttribute(
        "aria-label",
        `${state.player.thread} of ${MAX_THREAD} thread charges`
      );

      stage.dataset.phase = String(state.phase);
      stage.dataset.bossHealth = Math.max(
        0,
        Math.round(state.phaseHealth)
      ).toString();
      stage.dataset.playerHealth = String(state.player.health);
      stage.dataset.thread = String(state.player.thread);
    }

    function addParticles(x, y, color, count, speed = 100) {
      for (let index = 0; index < count; index += 1) {
        const angle = (index / Math.max(1, count)) * TAU +
          Math.sin(index * 9.17) * 0.36;
        const velocity = speed * (0.46 + ((index * 37) % 11) / 10);
        state.particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 0.28 + (index % 4) * 0.06,
          maxLife: 0.46,
          color,
          size: 1 + (index % 3) * 0.7
        });
      }
    }

    function clearCombatEntities(keepParticles = true) {
      state.minions = [];
      state.anchors = [];
      state.seals = [];
      state.debris = [];
      state.projectiles = [];
      state.playerShots = [];
      state.beams = [];
      state.zones = [];
      state.shockwaves = [];
      state.slashes = [];
      state.platforms = [];
      state.assistedTarget = null;
      if (!keepParticles) {
        state.particles = [];
      }
    }

    function getEye(world = state.world) {
      return world?.eye || { x: 0, y: 0, radius: 42 };
    }

    function getGazeCrownEmitters(world = state.world) {
      const eye = getEye(world);
      const width = world?.width || 900;
      const height = world?.height || 700;
      const spread = clamp(width * 0.115, 86, 132);
      const drop = clamp(height * 0.082, 48, 68);
      return [
        { x: eye.x - spread, y: eye.y + drop, rotation: -0.56 },
        { x: eye.x, y: eye.y + drop * 1.34, rotation: 0 },
        { x: eye.x + spread, y: eye.y + drop, rotation: 0.56 }
      ];
    }

    function getPlayerHurtbox(world = state.world) {
      const player = world?.player || { x: 0, y: 0 };
      const sliding = player.slideTime > 0;
      const lowProfile = sliding || (
        player.grounded &&
        world?.keys?.has("s")
      );
      if (sliding) {
        return {
          left: player.x - 24,
          right: player.x + 24,
          top: player.y - 23,
          bottom: player.y - 3
        };
      }
      if (lowProfile) {
        return {
          left: player.x - 14,
          right: player.x + 14,
          top: player.y - 36,
          bottom: player.y - 3
        };
      }
      return {
        left: player.x - 11,
        right: player.x + 11,
        top: player.y - 58,
        bottom: player.y - 3
      };
    }

    function getPlayerCenter(world = state.world) {
      const hurtbox = getPlayerHurtbox(world);
      return {
        x: (hurtbox.left + hurtbox.right) * 0.5,
        y: (hurtbox.top + hurtbox.bottom) * 0.5,
        radius: Math.min(
          (hurtbox.right - hurtbox.left) * 0.5,
          (hurtbox.bottom - hurtbox.top) * 0.5
        )
      };
    }

    function spawnMinions(world) {
      const eye = getEye(world);
      const count = 6;
      const roles = [
        "lancer",
        "artillery",
        "warden",
        "lancer",
        "artillery",
        "warden"
      ];
      state.minions = Array.from({ length: count }, (_, index) => {
        const side = index % 2 ? 1 : -1;
        const rank = Math.floor(index / 2);
        const role = roles[index];
        return {
          id: `scribe-${index}`,
          role,
          x: eye.x,
          y: eye.y,
          targetX: eye.x + side * (124 + rank * 86),
          targetY: eye.y + 105 + rank * 66,
          orbitOffset: index * 1.37,
          health: 28,
          maxHealth: 28,
          radius: role === "lancer" ? 16 : 18,
          assembly: 0,
          assemblyDelay: index * 0.17,
          attackClock: 1.25 + index * 0.27,
          mode: "hover",
          modeTimer: 1.25 + (index % 3) * 0.42,
          vx: 0,
          vy: 0,
          diveTargetX: 0,
          diveTargetY: 0,
          homeX: eye.x + side * (124 + rank * 86),
          homeY: eye.y + 105 + rank * 66,
          hitFlash: 0,
          dead: false
        };
      });
      stage.dataset.minions = String(count);
    }

    function spawnAnchor(world) {
      if (state.anchorIndex >= 3 || state.anchors.length) {
        return;
      }
      const bounds = world.platformBounds;
      const playerX = world.player.x;
      const span = bounds.right - bounds.left;
      const positions = [
        playerX < world.width * 0.5
          ? bounds.right - span * 0.12
          : bounds.left + span * 0.12,
        playerX < world.width * 0.5
          ? bounds.right - span * 0.19
          : bounds.left + span * 0.19,
        world.width * 0.5
      ];
      const anchor = {
        id: `anchor-${state.anchorIndex}`,
        x: positions[state.anchorIndex],
        y: world.groundY,
        health: state.anchorIndex === 2 ? 72 : 62,
        maxHealth: state.anchorIndex === 2 ? 72 : 62,
        radius: 27,
        assembly: 0,
        hitFlash: 0
      };
      state.anchors.push(anchor);
      const platformPairs = [
        [state.platforms[0], state.platforms[2]],
        [state.platforms[2], state.platforms[1]],
        [state.platforms[0], state.platforms[1]]
      ];
      state.seals = (platformPairs[state.anchorIndex] || [])
        .filter(Boolean)
        .map((platform, sealIndex) => ({
          id: `seal-${state.anchorIndex}-${sealIndex}`,
          anchorId: anchor.id,
          x: platform.x + platform.width * (sealIndex ? 0.68 : 0.32),
          y: platform.y - 15,
          radius: 14,
          health: 28,
          maxHealth: 28,
          hitFlash: 0,
          pulse: sealIndex * Math.PI
        }));
      setObjective(
        `Break both elevated seals guarding anchor ${state.anchorIndex + 1}.`
      );
      stage.dataset.anchors = `${state.anchorIndex}/3`;
      onCue("assemble", 0.72 + state.anchorIndex * 0.12);
    }

    function enterPhase(phase, world, initial = false) {
      state.phase = phase;
      state.phaseHealth = 100;
      state.phaseTime = 0;
      state.transitionTime = 0;
      state.transitionPulse = initial ? 0 : 1;
      state.patternIndex = 0;
      state.attackTimer = phase === 1 ? 1.8 : phase === 2 ? 1.15 : 1.2;
      state.wardOpen = false;
      state.anchorIndex = 0;
      state.anchorDelay = 0.8;
      clearCombatEntities(true);
      onCursorMode(phase === 3);
      if (phase === 3) {
        stage.dataset.phaseConstruct = "gaze-crown";
      } else {
        stage.removeAttribute("data-phase-construct");
      }
      onPhaseChange(phase);
      onDeathMode(false);
      onVictoryMode(false);

      const bounds = world.platformBounds;
      const span = bounds.right - bounds.left;
      if (phase === 2) {
        state.platforms = [
          {
            id: "assembly-left",
            x: bounds.left + span * 0.08,
            y: world.groundY - 118,
            width: span * 0.25
          },
          {
            id: "assembly-right",
            x: bounds.right - span * 0.33,
            y: world.groundY - 132,
            width: span * 0.25
          },
          {
            id: "assembly-crown",
            x: bounds.left + span * 0.36,
            y: world.groundY - 224,
            width: span * 0.28
          }
        ];
      } else if (phase === 3) {
        state.platforms = [
          {
            id: "gaze-left",
            x: bounds.left + span * 0.12,
            y: world.groundY - 124,
            width: span * 0.2
          },
          {
            id: "gaze-right",
            x: bounds.right - span * 0.32,
            y: world.groundY - 124,
            width: span * 0.2
          },
          {
            id: "gaze-crown",
            x: bounds.left + span * 0.39,
            y: world.groundY - 222,
            width: span * 0.22
          }
        ];
      }

      if (phase === 1) {
        spawnMinions(world);
        setObjective("Sever the six assembled scribes.");
      } else if (phase === 2) {
        setObjective("Climb the forming lines. Break the seals.");
      } else {
        setObjective("Turn the crown's red facets back into the pupil.");
      }

      stage.dataset.phase = String(phase);
      stage.dataset.phaseState = "active";
      updateHud(true);
      if (!initial) {
        onCue("phase", phase);
        if (phase === 3) {
          onCue("crown-assemble", 1);
        }
        addParticles(
          getEye(world).x,
          getEye(world).y,
          phase === 3 ? "#fff048" : "#ff8f26",
          26,
          190
        );
      }
    }

    function beginTransition(world) {
      if (state.transitionTime > 0 || state.phase >= 3) {
        return;
      }
      state.transitionTime = 2.2;
      state.player.invulnerable = Math.max(
        state.player.invulnerable,
        2.2
      );
      stage.dataset.phaseState = "transition";
      state.projectiles = [];
      state.debris = [];
      state.shockwaves = [];
      state.beams = [];
      setObjective("The eye recoils. Its pattern is changing.");
      onCue("phase-break", state.phase);
      addParticles(
        getEye(world).x,
        getEye(world).y,
        "#ff1f2d",
        34,
        240
      );
      updateHud(true);
    }

    function damageBoss(amount, world, color = "#69ddff") {
      if (
        !state.active ||
        state.transitionTime > 0 ||
        amount <= 0
      ) {
        return false;
      }
      state.phaseHealth = Math.max(0, state.phaseHealth - amount);
      state.transitionPulse = 1;
      const eye = getEye(world);
      addParticles(eye.x, eye.y, color, 8, 130);
      onCue("boss-hit", clamp(amount / 12, 0.25, 1));
      updateHud(true);

      if (state.phaseHealth <= 0) {
        if (state.phase < 3) {
          beginTransition(world);
        } else {
          state.active = false;
          state.victoryTime = 0.001;
          stage.dataset.phaseState = "defeated";
          setObjective("The gaze is broken.");
          onCursorMode(false);
          onVictoryMode(true);
          onPhaseChange(4);
          onCue("victory", 1);
          clearCombatEntities(true);
          state.victoryFragments = Array.from(
            { length: 42 },
            (_, index) => {
              const angle = (index / 42) * TAU +
                Math.sin(index * 4.91) * 0.22;
              const speed = 105 + (index % 9) * 28;
              return {
                x: eye.x,
                y: eye.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 42,
                rotation: angle,
                rotationSpeed: (index % 2 ? 1 : -1) * (2 + index % 5),
                length: 8 + index % 6 * 3,
                delay: VICTORY_SPLINTER_AT + (index % 5) * 0.06,
                life: 3.2 + index % 5 * 0.12,
                maxLife: 3.8
              };
            }
          );
          const crackEdges = [
            [-0.82, -1, -2.82, 0.27],
            [-0.24, -1, -1.62, 0.49],
            [0.72, -1, -0.42, 0.34],
            [0.52, 1, 0.84, 0.56],
            [-0.58, 1, 2.4, 0.39]
          ];
          state.victoryRays = crackEdges.map(
            ([edgeX, side, beamAngle, inward], index) => {
              const edgeHeight = Math.pow(
                Math.max(0, 1 - edgeX * edgeX),
                0.58
              );
              const rimX = eye.x + edgeX * (eye.halfWidth || eye.radius * 2.5);
              const rimY = eye.y + side * (eye.halfHeight || eye.radius) * edgeHeight;
              return {
                edgeX,
                side,
                beamAngle,
                delay: 0.82 + index * 0.76,
                width: 42 + (index % 3) * 18,
                originX: lerp(rimX, eye.x, inward),
                originY: lerp(rimY, eye.y, inward),
                reach: 1.08 + (index % 4) * 0.16
              };
            }
          );
          state.crackCues = state.victoryRays.map(() => false);
          state.splinterCuePlayed = false;
          if (resultTimeDisplay) {
            resultTimeDisplay.textContent = formatEncounterTime(state.encounterElapsed);
          }
          if (resultHeartsDisplay) {
            resultHeartsDisplay.textContent = String(state.heartsLost);
          }
          state.resultShown = false;
          delete stage.dataset.resultState;
          if (resultPanel) {
            resultPanel.setAttribute("aria-hidden", "true");
          }
          addParticles(eye.x, eye.y, "#fff048", 62, 320);
        }
      }
      return true;
    }

    function spawnProjectile({
      x,
      y,
      vx,
      vy,
      radius = 5,
      damage = 1,
      life = 5,
      bounces = 0,
      color = "#ff1f2d",
      kind = "orb",
      friendly = false
    }) {
      state.projectiles.push({
        x,
        y,
        vx,
        vy,
        radius,
        damage,
        life,
        bounces,
        color,
        kind,
        friendly,
        reflected: friendly,
        age: 0,
        trail: []
      });
    }

    function spawnAimedVolley(
      origin,
      world,
      count,
      speed,
      spread = 0.16,
      cueName = "enemy-shot"
    ) {
      const player = getPlayerCenter(world);
      const baseAngle = Math.atan2(player.y - origin.y, player.x - origin.x);
      for (let index = 0; index < count; index += 1) {
        const offset = (index - (count - 1) / 2) * spread;
        const angle = baseAngle + offset;
        spawnProjectile({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 4.6,
          damage: 1,
          life: 5,
          color: "#ff3442",
          kind: "needle"
        });
      }
      onCue(cueName, count / 7);
    }

    function spawnBeam(world, sweep = false) {
      const eye = getEye(world);
      const bounds = world.platformBounds;
      const targetX = clamp(
        world.player.x + world.player.vx * 0.42,
        bounds.left + 40,
        bounds.right - 40
      );
      state.beams.push({
        x1: eye.x,
        y1: eye.y,
        targetX,
        targetY: world.groundY,
        age: 0,
        telegraph: sweep ? 0.72 : 0.56,
        active: sweep ? 0.58 : 0.32,
        width: sweep ? 19 : 15,
        sweep: sweep ? (targetX < eye.x ? 1 : -1) : 0,
        damageDone: false
      });
      onCue("telegraph", sweep ? 1 : 0.7);
    }

    function spawnDebris(world, heavy = false) {
      const eye = getEye(world);
      const bounds = world.platformBounds;
      const prediction = world.player.x + world.player.vx * (heavy ? 0.5 : 0.32);
      const targetX = clamp(
        prediction + Math.sin(state.phaseTime * 8.3) * (heavy ? 22 : 48),
        bounds.left + 24,
        bounds.right - 24
      );
      const size = heavy ? 29 : 18 + (state.patternIndex % 3) * 4;
      state.debris.push({
        x: eye.x,
        y: eye.y,
        formX: targetX,
        formY: 118 + (state.patternIndex % 3) * 34,
        targetX,
        assembly: 0,
        delay: 0,
        falling: false,
        vy: 0,
        rotation: state.patternIndex * 0.73,
        rotationSpeed: (state.patternIndex % 2 ? 1 : -1) * 2.6,
        size,
        heavy,
        health: heavy ? 34 : 18,
        dead: false
      });
      onCue("assemble", heavy ? 1 : 0.55);
    }

    function spawnShockwaves(debris, world) {
      [-1, 1].forEach((direction) => {
        state.shockwaves.push({
          x: debris.x,
          y: world.groundY,
          vx: direction * (debris.heavy ? 370 : 290),
          life: debris.heavy ? 1.65 : 1.2,
          radius: debris.heavy ? 17 : 13,
          damage: debris.heavy ? 2 : 1
        });
      });
      onCue("debris-impact", debris.heavy ? 1 : 0.65);
      addParticles(
        debris.x,
        world.groundY - 3,
        "#a9b4bd",
        debris.heavy ? 20 : 12,
        debris.heavy ? 190 : 120
      );
    }

    function spawnRicochetRing(world, count = 10, speed = 190) {
      const eye = getEye(world);
      const offset = state.patternIndex * 0.31;
      for (let index = 0; index < count; index += 1) {
        const angle = offset + (index / count) * TAU;
        spawnProjectile({
          x: eye.x,
          y: eye.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5.4,
          damage: 1,
          life: 10,
          bounces: 5,
          color: "#ff1f2d",
          kind: "ricochet"
        });
      }
      onCue("ricochet-ring", count / 14);
    }

    function spawnSplitterVolley(world) {
      const emitters = getGazeCrownEmitters(world);
      const emitterIndex = state.patternIndex % emitters.length;
      const emitter = emitters[emitterIndex];
      const player = getPlayerCenter(world);
      const direction = normalizeVector(
        player.x + world.player.vx * 0.28 - emitter.x,
        player.y - emitter.y,
        0,
        1
      );
      spawnProjectile({
        x: emitter.x,
        y: emitter.y,
        vx: direction.x * 230,
        vy: direction.y * 230,
        radius: 8,
        damage: 2,
        life: 5.5,
        color: "#ff8f26",
        kind: "splitter"
      });
      onCue("crown-emitter", emitterIndex + 1);
      onCue("crown-splitter", 0.9);
    }

    function spawnRupture(world) {
      const bounds = world.platformBounds;
      const emitters = getGazeCrownEmitters(world);
      const emitterIndex = (state.patternIndex + 1) % emitters.length;
      const emitter = emitters[emitterIndex];
      const targetX = clamp(
        world.player.x + world.player.vx * 0.4,
        bounds.left + 50,
        bounds.right - 50
      );
      const direction = normalizeVector(
        targetX - emitter.x,
        world.groundY - emitter.y
      );
      spawnProjectile({
        x: emitter.x,
        y: emitter.y,
        vx: direction.x * 260,
        vy: direction.y * 260,
        radius: 10,
        damage: 2,
        life: 5,
        color: "#fff048",
        kind: "rupture"
      });
      onCue("crown-emitter", emitterIndex + 1);
      onCue("crown-rupture", 0.82);
    }

    function spawnFloorSurge(world) {
      state.zones.push({
        x: world.width * 0.5,
        y: world.groundY,
        radius: (world.platformBounds.right - world.platformBounds.left) * 0.48,
        age: 0,
        telegraph: 0.9,
        active: 1.25,
        damageClock: 0,
        kind: "floor-surge"
      });
      onCue("crown-floor-surge", 1);
    }

    function runPhasePattern(world) {
      state.patternIndex += 1;
      if (state.phase === 1) {
        if (state.patternIndex % 4 === 0) {
          const crossing = state.patternIndex % 8 === 0;
          spawnBeam(world, crossing);
          if (crossing) {
            const firstBeam = state.beams[state.beams.length - 1];
            state.beams.push({
              ...firstBeam,
              targetX: clamp(
                firstBeam.targetX + (firstBeam.sweep > 0 ? 210 : -210),
                world.platformBounds.left + 24,
                world.platformBounds.right - 24
              ),
              sweep: -firstBeam.sweep,
              age: -0.12,
              damageDone: false
            });
          }
          state.attackTimer = crossing ? 2.5 : 1.95;
        } else {
          spawnAimedVolley(
            getEye(world),
            world,
            state.wardOpen ? 5 : 3,
            state.wardOpen ? 245 : 205,
            0.15
          );
          state.attackTimer = state.wardOpen ? 1.55 : 2.05;
        }
      } else if (state.phase === 2) {
        const heavy = state.patternIndex % 5 === 0;
        spawnDebris(world, heavy);
        if (state.patternIndex % 3 === 0) {
          spawnDebris(world, false);
        }
        if (state.patternIndex % 4 === 2) {
          spawnBeam(world, false);
        }
        state.attackTimer = Math.max(0.82, 1.35 - state.anchorIndex * 0.13);
      } else if (state.phase === 3) {
        const pattern = state.patternIndex % 5;
        if (pattern === 1) {
          spawnRicochetRing(
            world,
            9 + Math.min(4, Math.floor((100 - state.phaseHealth) / 22)),
            176 + (100 - state.phaseHealth) * 0.55
          );
          state.attackTimer = 2.1;
        } else if (pattern === 2) {
          spawnSplitterVolley(world);
          state.attackTimer = 1.45;
        } else if (pattern === 3) {
          spawnRupture(world);
          state.attackTimer = 1.35;
        } else if (pattern === 4) {
          spawnFloorSurge(world);
          spawnRicochetRing(world, 7, 225);
          state.attackTimer = 2.15;
        } else {
          const emitters = getGazeCrownEmitters(world);
          const emitterIndex = state.patternIndex % emitters.length;
          const emitter = emitters[emitterIndex];
          onCue("crown-emitter", emitterIndex + 1);
          spawnAimedVolley(
            emitter,
            world,
            state.phaseHealth < 45 ? 7 : 5,
            state.phaseHealth < 45 ? 315 : 270,
            0.13,
            "crown-volley"
          );
          state.projectiles.slice(-7).forEach((projectile) => {
            projectile.kind = "ricochet";
            projectile.bounces = 3;
            projectile.life = 8;
          });
          state.attackTimer = state.phaseHealth < 45 ? 0.92 : 1.22;
        }
      }
    }

    function triggerPlayerDeath(reason, world) {
      if (state.player.deathTimer > 0) {
        return;
      }
      state.player.health = 0;
      state.player.deathTimer = 2.75;
      state.player.invulnerable = 3;
      clearCombatEntities(true);
      stage.dataset.phaseState = "death";
      onDeathMode(true);
      onCursorMode(false);
      setObjective(
        reason === "fall"
          ? "The line rejects the fallen."
          : "YOU HAVE BEEN SEEN."
      );
      onPlayerDeath(reason);
      onCue(reason === "fall" ? "fall-death" : "player-death", 1);
      if (world) {
        const player = getPlayerCenter(world);
        addParticles(player.x, player.y, "#ff1f2d", 24, 220);
      }
      updateHud(true);
    }

    function healPlayer(amount, x, y) {
      if (state.player.health >= MAX_PLAYER_HEALTH) {
        return;
      }
      state.player.health = Math.min(
        MAX_PLAYER_HEALTH,
        state.player.health + amount
      );
      addParticles(x, y, "#69ddff", 8, 85);
      onCue("thread-ready", 0.72);
      updateHud(true);
    }

    function damagePlayer(amount, source, world) {
      const player = world.player;
      if (
        state.player.invulnerable > 0 ||
        state.player.deathTimer > 0 ||
        player.dashTime > 0.025 ||
        player.respawnTimer > 0
      ) {
        return false;
      }
      state.player.health = Math.max(0, state.player.health - amount);
      state.heartsLost += amount;
      state.player.invulnerable = 0.78;
      state.player.hitFlash = 1;
      const direction = normalizeVector(
        player.x - source.x,
        player.y - 34 - source.y,
        player.facing,
        -0.2
      );
      player.vx += direction.x * 260;
      player.vy = Math.min(player.vy, -220 + direction.y * 90);
      player.grounded = false;
      onCue("player-hit", amount / 2);
      addParticles(player.x, player.y - 31, "#ff1f2d", 14, 170);
      updateHud(true);
      if (state.player.health <= 0) {
        triggerPlayerDeath("damage", world);
      }
      return true;
    }

    function reflectProjectile(projectile, world, origin) {
      if (projectile.friendly) {
        return;
      }
      const eye = getEye(world);
      const direction = normalizeVector(
        eye.x - projectile.x,
        eye.y - projectile.y,
        0,
        -1
      );
      projectile.vx = direction.x * 430;
      projectile.vy = direction.y * 430;
      projectile.friendly = true;
      projectile.reflected = true;
      projectile.color = "#69ddff";
      projectile.life = Math.max(projectile.life, 2.8);
      projectile.bounces = Math.max(projectile.bounces, 1);
      projectile.damage = 0;
      state.pointer.cooldown = DEFLECTOR_RECOVERY;
      addParticles(origin.x, origin.y, "#69ddff", 9, 130);
      onCue("reflect", 1);
    }

    function spawnControlZone(minion, world) {
      const bounds = world.platformBounds;
      state.zones.push({
        x: clamp(
          world.player.x + world.player.vx * 0.34,
          bounds.left + 54,
          bounds.right - 54
        ),
        y: world.groundY,
        radius: 54,
        age: 0,
        telegraph: 0.78,
        active: 1.7,
        damageClock: 0,
        sourceX: minion.x,
        sourceY: minion.y,
        kind: "control"
      });
      onCue("telegraph", 0.68);
    }

    function updateMinions(deltaTime, world) {
      const eye = getEye(world);
      const playerCenter = getPlayerCenter(world);
      const playerHurtbox = getPlayerHurtbox(world);
      const bounds = world.platformBounds;

      state.minions.forEach((minion) => {
        if (minion.dead) {
          return;
        }
        minion.assemblyDelay -= deltaTime;
        if (minion.assemblyDelay > 0) {
          return;
        }
        minion.assembly = Math.min(1, minion.assembly + deltaTime * 1.25);
        minion.hitFlash = Math.max(0, minion.hitFlash - deltaTime * 7);
        const assembled = easeOutCubic(minion.assembly);

        if (minion.assembly < 1) {
          const stagingX = minion.homeX +
            Math.sin(state.phaseTime + minion.orbitOffset) * 20;
          const stagingY = minion.homeY +
            Math.cos(state.phaseTime * 1.2 + minion.orbitOffset) * 12;
          minion.x = lerp(eye.x, stagingX, assembled);
          minion.y = lerp(eye.y, stagingY, assembled);
          return;
        }

        minion.attackClock -= deltaTime;
        minion.modeTimer -= deltaTime;

        if (minion.role === "artillery") {
          const orbitRadiusX = 76 + Math.floor(minion.orbitOffset) * 8;
          const orbitRadiusY = 28 + (minion.orbitOffset % 1) * 12;
          const angle = state.phaseTime * (
            minion.id.endsWith("1") ? -0.82 : 0.82
          ) + minion.orbitOffset;
          minion.x = clamp(
            eye.x + Math.cos(angle) * orbitRadiusX * 2.05,
            bounds.left + 30,
            bounds.right - 30
          );
          minion.y = eye.y + 142 + Math.sin(angle * 1.35) * orbitRadiusY;
          if (minion.attackClock <= 0) {
            spawnAimedVolley(
              minion,
              world,
              state.wardOpen ? 5 : 3,
              state.wardOpen ? 236 : 208,
              0.19
            );
            minion.attackClock = state.wardOpen ? 1.65 : 2.15;
          }
          return;
        }

        if (minion.role === "warden") {
          const direction = minion.id.endsWith("2") ? 1 : -1;
          minion.x = clamp(
            eye.x + Math.sin(
              state.phaseTime * 0.72 * direction + minion.orbitOffset
            ) * (bounds.right - bounds.left) * 0.38,
            bounds.left + 32,
            bounds.right - 32
          );
          minion.y = world.groundY - 176 +
            Math.cos(state.phaseTime * 1.32 + minion.orbitOffset) * 24;
          if (minion.attackClock <= 0) {
            spawnControlZone(minion, world);
            minion.attackClock = state.wardOpen ? 2.05 : 2.65;
          }
          return;
        }

        if (minion.mode === "hover") {
          minion.x = minion.homeX +
            Math.sin(state.phaseTime * 1.6 + minion.orbitOffset) * 34;
          minion.y = minion.homeY +
            Math.cos(state.phaseTime * 1.9 + minion.orbitOffset) * 24;
          if (minion.modeTimer <= 0) {
            minion.mode = "windup";
            minion.modeTimer = 0.48;
            minion.diveTargetX = clamp(
              world.player.x + world.player.vx * 0.3,
              bounds.left + 24,
              bounds.right - 24
            );
            minion.diveTargetY = playerCenter.y;
            onCue("telegraph", 0.78);
          }
        } else if (minion.mode === "windup") {
          minion.x += (minion.homeX - minion.x) * deltaTime * 4;
          minion.y -= 34 * deltaTime;
          if (minion.modeTimer <= 0) {
            const direction = normalizeVector(
              minion.diveTargetX - minion.x,
              minion.diveTargetY - minion.y,
              0,
              1
            );
            minion.vx = direction.x * 420;
            minion.vy = direction.y * 420;
            minion.mode = "dive";
            minion.modeTimer = 0.82;
          }
        } else if (minion.mode === "dive") {
          minion.x += minion.vx * deltaTime;
          minion.y += minion.vy * deltaTime;
          if (circleIntersectsRect({
            x: minion.x,
            y: minion.y,
            radius: minion.radius
          }, playerHurtbox)) {
            damagePlayer(2, minion, world);
            minion.mode = "return";
            minion.modeTimer = 1.2;
          } else if (
            minion.modeTimer <= 0 ||
            minion.y > world.groundY + 24
          ) {
            minion.mode = "return";
            minion.modeTimer = 1.2;
          }
        } else {
          const direction = normalizeVector(
            minion.homeX - minion.x,
            minion.homeY - minion.y,
            0,
            -1
          );
          minion.x += direction.x * 290 * deltaTime;
          minion.y += direction.y * 290 * deltaTime;
          if (
            distanceBetween(minion, {
              x: minion.homeX,
              y: minion.homeY
            }) < 18
          ) {
            minion.mode = "hover";
            minion.modeTimer = 1.35 + (minion.orbitOffset % 0.7);
          }
        }
      });
    }

    function updateAnchors(deltaTime, world) {
      if (!state.anchors.length && state.anchorIndex < 3) {
        state.anchorDelay -= deltaTime;
        if (state.anchorDelay <= 0) {
          spawnAnchor(world);
        }
      }
      state.anchors.forEach((anchor) => {
        anchor.assembly = Math.min(1, anchor.assembly + deltaTime * 0.92);
        anchor.hitFlash = Math.max(0, anchor.hitFlash - deltaTime * 8);
      });
      state.seals.forEach((seal) => {
        seal.hitFlash = Math.max(0, seal.hitFlash - deltaTime * 8);
        seal.pulse += deltaTime * 2.8;
      });
    }

    function updateDebris(deltaTime, world) {
      state.debris.forEach((debris) => {
        if (debris.dead) {
          return;
        }
        debris.rotation += debris.rotationSpeed * deltaTime;
        if (!debris.falling) {
          debris.assembly = Math.min(1, debris.assembly + deltaTime * 1.35);
          const assembled = easeOutCubic(debris.assembly);
          const eye = getEye(world);
          debris.x = lerp(eye.x, debris.formX, assembled);
          debris.y = lerp(eye.y, debris.formY, assembled);
          if (debris.assembly >= 1) {
            debris.delay += deltaTime;
            if (debris.delay >= 0.34) {
              debris.falling = true;
              debris.vy = debris.heavy ? 310 : 255;
            }
          }
          return;
        }

        debris.vy += (debris.heavy ? 730 : 620) * deltaTime;
        debris.y += debris.vy * deltaTime;
        if (circleIntersectsRect({
          x: debris.x,
          y: debris.y,
          radius: debris.size * 0.62
        }, getPlayerHurtbox(world))) {
          damagePlayer(debris.heavy ? 2 : 1, debris, world);
          debris.dead = true;
        }
        if (debris.y + debris.size >= world.groundY) {
          debris.y = world.groundY - debris.size;
          spawnShockwaves(debris, world);
          debris.dead = true;
        }
      });
      state.debris = state.debris.filter((debris) => !debris.dead);
    }

    function updateBeams(deltaTime, world) {
      const playerHurtbox = getPlayerHurtbox(world);
      state.beams.forEach((beam) => {
        beam.age += deltaTime;
        const activeStart = beam.telegraph;
        const activeEnd = activeStart + beam.active;
        if (beam.age < activeStart * 0.7) {
          const bounds = world.platformBounds;
          beam.targetX = clamp(
            world.player.x + world.player.vx * 0.24,
            bounds.left + 24,
            bounds.right - 24
          );
        }
        if (beam.sweep && beam.age > activeStart) {
          beam.targetX += beam.sweep * 430 * deltaTime;
        }
        if (
          beam.age >= activeStart &&
          beam.age <= activeEnd &&
          !beam.damageDone
        ) {
          const hit = segmentIntersectsRect(
            { x: beam.x1, y: beam.y1 },
            { x: beam.targetX, y: beam.targetY },
            playerHurtbox,
            beam.width * 0.5
          );
          if (hit) {
            if (damagePlayer(beam.sweep ? 2 : 1, {
              x: beam.targetX,
              y: beam.targetY
            }, world)) {
              beam.damageDone = true;
            }
          }
        }
      });
      state.beams = state.beams.filter(
        (beam) => beam.age < beam.telegraph + beam.active + 0.18
      );
    }

    function updateShockwaves(deltaTime, world) {
      const playerHurtbox = getPlayerHurtbox(world);
      state.shockwaves.forEach((shockwave) => {
        shockwave.x += shockwave.vx * deltaTime;
        shockwave.life -= deltaTime;
        if (
          circleIntersectsRect({
            x: shockwave.x,
            y: shockwave.y - 8,
            radius: shockwave.radius
          }, playerHurtbox)
        ) {
          damagePlayer(shockwave.damage, shockwave, world);
          shockwave.life = 0;
        }
      });
      state.shockwaves = state.shockwaves.filter((shockwave) => (
        shockwave.life > 0 &&
        shockwave.x > 0 &&
        shockwave.x < world.width
      ));
    }

    function updateProjectiles(deltaTime, world) {
      const playerHurtbox = getPlayerHurtbox(world);
      const eye = getEye(world);
      state.projectiles.forEach((projectile) => {
        projectile.age += deltaTime;
        projectile.life -= deltaTime;
        if (
          projectile.kind === "splitter" &&
          projectile.age >= 0.9 &&
          !projectile.split
        ) {
          projectile.split = true;
          const baseAngle = Math.atan2(projectile.vy, projectile.vx);
          [-0.58, -0.29, 0, 0.29, 0.58].forEach((offset) => {
            const angle = baseAngle + offset;
            spawnProjectile({
              x: projectile.x,
              y: projectile.y,
              vx: Math.cos(angle) * 285,
              vy: Math.sin(angle) * 285,
              radius: 4.5,
              damage: 1,
              life: 3.6,
              color: "#ff8f26",
              kind: "needle"
            });
          });
          projectile.life = 0;
          addParticles(projectile.x, projectile.y, "#ff8f26", 12, 135);
          onCue("enemy-shot", 1);
        }
        projectile.trail.push({
          x: projectile.x,
          y: projectile.y,
          life: 0.15
        });
        projectile.trail.forEach((point) => {
          point.life -= deltaTime;
        });
        projectile.trail = projectile.trail.filter((point) => point.life > 0);
        projectile.x += projectile.vx * deltaTime;
        projectile.y += projectile.vy * deltaTime;

        if (
          state.phase === 3 &&
          !projectile.friendly &&
          projectile.age >= 0.18 &&
          state.pointer.pulse > 0 &&
          Math.hypot(
            projectile.x - state.pointer.x,
            projectile.y - state.pointer.y
          ) < state.pointer.radius + projectile.radius
        ) {
          reflectProjectile(projectile, world, state.pointer);
        }

        if (projectile.kind === "ricochet") {
          let bounced = false;
          if (
            projectile.x <= 16 + projectile.radius &&
            projectile.vx < 0
          ) {
            projectile.x = 16 + projectile.radius;
            projectile.vx *= -1;
            bounced = true;
          } else if (
            projectile.x >= world.width - 16 - projectile.radius &&
            projectile.vx > 0
          ) {
            projectile.x = world.width - 16 - projectile.radius;
            projectile.vx *= -1;
            bounced = true;
          }
          if (
            projectile.y <= 18 + projectile.radius &&
            projectile.vy < 0
          ) {
            projectile.y = 18 + projectile.radius;
            projectile.vy *= -1;
            bounced = true;
          } else if (
            projectile.y >= world.groundY - projectile.radius &&
            projectile.vy > 0
          ) {
            projectile.y = world.groundY - projectile.radius;
            projectile.vy *= -1;
            bounced = true;
          }
          if (bounced) {
            projectile.bounces -= 1;
            projectile.life = Math.min(projectile.life, 4.5);
            addParticles(
              projectile.x,
              projectile.y,
              projectile.color,
              3,
              65
            );
            if (projectile.bounces < 0) {
              projectile.life = 0;
            }
          }
        }

        if (
          projectile.kind === "rupture" &&
          projectile.y + projectile.radius >= world.groundY
        ) {
          state.zones.push({
            x: projectile.x,
            y: world.groundY,
            radius: 74,
            age: 0,
            telegraph: 0.12,
            active: 2.15,
            damageClock: 0,
            kind: "control"
          });
          addParticles(
            projectile.x,
            world.groundY - 4,
            "#fff048",
            17,
            175
          );
          onCue("debris-impact", 0.92);
          projectile.life = 0;
        }

        if (
          projectile.friendly &&
          distanceBetween(projectile, eye) <
            projectile.radius + eye.radius
        ) {
          if (state.phase === 3) {
            onCue("crown-resonance", 1);
            damageBoss(3, world, "#69ddff");
          }
          projectile.life = 0;
          return;
        }

        if (
          !projectile.friendly &&
          circleIntersectsRect(projectile, playerHurtbox)
        ) {
          if (damagePlayer(projectile.damage, projectile, world)) {
            projectile.life = 0;
          }
        }

        if (
          projectile.x < -90 ||
          projectile.x > world.width + 90 ||
          projectile.y < -100 ||
          projectile.y > world.height + 100
        ) {
          projectile.life = 0;
        }
      });
      state.projectiles = state.projectiles.filter(
        (projectile) => projectile.life > 0
      );
    }

    function updateZones(deltaTime, world) {
      const playerHurtbox = getPlayerHurtbox(world);
      state.zones.forEach((zone) => {
        zone.age += deltaTime;
        zone.damageClock = Math.max(0, zone.damageClock - deltaTime);
        const active = (
          zone.age >= zone.telegraph &&
          zone.age <= zone.telegraph + zone.active
        );
        const zoneRect = zone.kind === "floor-surge"
          ? {
              left: zone.x - zone.radius,
              right: zone.x + zone.radius,
              top: world.groundY - 32,
              bottom: world.groundY + 6
            }
          : {
              left: zone.x - zone.radius,
              right: zone.x + zone.radius,
              top: zone.y - zone.radius * 0.48,
              bottom: zone.y + 5
            };
        if (
          active &&
          zone.damageClock <= 0 &&
          playerHurtbox.right >= zoneRect.left &&
          playerHurtbox.left <= zoneRect.right &&
          playerHurtbox.bottom >= zoneRect.top &&
          playerHurtbox.top <= zoneRect.bottom
        ) {
          if (damagePlayer(
            zone.kind === "floor-surge" ? 2 : 1,
            { x: zone.x, y: zoneRect.top },
            world
          )) {
            zone.damageClock = 0.52;
          }
        }
      });
      state.zones = state.zones.filter(
        (zone) => zone.age < zone.telegraph + zone.active
      );
    }

    function updatePlayerShots(deltaTime, world) {
      const eye = getEye(world);
      state.playerShots.forEach((shot) => {
        shot.life -= deltaTime;
        let target = null;
        if (shot.targetKind === "minion") {
          target = state.minions.find(
            (candidate) => candidate.id === shot.targetId && !candidate.dead
          );
        } else if (shot.targetKind === "seal") {
          target = state.seals.find(
            (candidate) => candidate.id === shot.targetId
          );
        } else if (shot.targetKind === "anchor") {
          const anchor = state.anchors.find(
            (candidate) => candidate.id === shot.targetId
          );
          target = anchor
            ? { x: anchor.x, y: anchor.y - 28 }
            : null;
        } else if (shot.targetKind === "eye") {
          target = eye;
        }
        if (target) {
          const speed = Math.hypot(shot.vx, shot.vy);
          const desired = normalizeVector(
            target.x - shot.x,
            target.y - shot.y,
            shot.vx,
            shot.vy
          );
          const blend = Math.min(1, deltaTime * 4.8);
          shot.vx = lerp(shot.vx, desired.x * speed, blend);
          shot.vy = lerp(shot.vy, desired.y * speed, blend);
        }
        shot.x += shot.vx * deltaTime;
        shot.y += shot.vy * deltaTime;

        for (const minion of state.minions) {
          if (
            !minion.dead &&
            minion.assembly >= 0.82 &&
            distanceBetween(shot, minion) < shot.radius + minion.radius
          ) {
            minion.health -= shot.damage;
            minion.hitFlash = 1;
            shot.life = 0;
            onCue("enemy-hit", 0.72);
            addParticles(minion.x, minion.y, "#fff048", 7, 105);
            if (minion.health <= 0) {
              killMinion(minion, world);
            }
            break;
          }
        }
        if (shot.life <= 0) {
          return;
        }

        for (const seal of state.seals) {
          if (
            distanceBetween(shot, seal) <
            shot.radius + seal.radius
          ) {
            damageSeal(seal, shot.damage, world);
            shot.life = 0;
            break;
          }
        }
        if (shot.life <= 0) {
          return;
        }

        const anchor = state.anchors[0];
        if (
          anchor &&
          (!shot.targetKind || shot.targetKind === "anchor") &&
          anchor.assembly >= 0.76 &&
          distanceBetween(shot, {
            x: anchor.x,
            y: anchor.y - 28
          }) < shot.radius + anchor.radius
        ) {
          damageAnchor(anchor, shot.damage, world);
          shot.life = 0;
          return;
        }

        for (const debris of state.debris) {
          if (
            (!shot.targetKind || shot.targetKind === "debris") &&
            debris.assembly >= 0.75 &&
            distanceBetween(shot, debris) <
              shot.radius + debris.size * 0.62
          ) {
            debris.health -= shot.damage;
            shot.life = 0;
            if (debris.health <= 0) {
              debris.dead = true;
              addParticles(debris.x, debris.y, "#a9b4bd", 10, 120);
              onCue("debris-break", debris.heavy ? 1 : 0.6);
            }
            break;
          }
        }
        if (shot.life <= 0) {
          return;
        }

        if (
          state.phase === 1 &&
          state.wardOpen &&
          distanceBetween(shot, eye) < shot.radius + eye.radius
        ) {
          damageBoss(8, world, "#fff048");
          shot.life = 0;
        }
      });
      state.playerShots = state.playerShots.filter((shot) => (
        shot.life > 0 &&
        shot.x > -40 &&
        shot.x < world.width + 40 &&
        shot.y > -40 &&
        shot.y < world.height + 40
      ));
    }

    function updateParticles(deltaTime) {
      state.particles.forEach((particle) => {
        particle.life -= deltaTime;
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.vx *= Math.pow(0.08, deltaTime);
        particle.vy = particle.vy * Math.pow(0.12, deltaTime) +
          70 * deltaTime;
      });
      state.particles = state.particles.filter(
        (particle) => particle.life > 0
      );
      state.slashes.forEach((slash) => {
        slash.life -= deltaTime;
      });
      state.slashes = state.slashes.filter((slash) => slash.life > 0);
    }

    function killMinion(minion, world) {
      if (minion.dead) {
        return;
      }
      minion.dead = true;
      state.phaseHealth = Math.max(40, state.phaseHealth - 10);
      addParticles(minion.x, minion.y, "#ff8f26", 18, 170);
      onCue("minion-break", 1);
      const remaining = state.minions.filter(
        (candidate) => !candidate.dead
      ).length;
      if (remaining % 2 === 1) {
        healPlayer(1, minion.x, minion.y);
      }
      stage.dataset.minions = String(remaining);
      if (!remaining) {
        state.wardOpen = true;
        setObjective("The ward is open. Send thread into the pupil.");
        onCue("ward-open", 1);
      } else {
        setObjective(`Sever the assembled scribes. ${remaining} remain.`);
      }
      updateHud(true);
    }

    function damageAnchor(anchor, amount, world) {
      if (!anchor || anchor.assembly < 0.76) {
        return;
      }
      if (state.seals.length) {
        anchor.hitFlash = 1;
        addParticles(anchor.x, anchor.y - 25, "#ff1f2d", 5, 80);
        onCue("ward-hit", 0.52);
        setObjective(
          `${state.seals.length} elevated seal${state.seals.length === 1 ? "" : "s"} still guard the anchor.`
        );
        return;
      }
      anchor.health -= amount;
      anchor.hitFlash = 1;
      addParticles(anchor.x, anchor.y - 25, "#fff048", 7, 105);
      onCue("enemy-hit", 0.75);
      if (anchor.health > 0) {
        return;
      }

      addParticles(anchor.x, anchor.y - 25, "#ff8f26", 24, 210);
      onCue("anchor-break", (state.anchorIndex + 1) / 3);
      state.anchors = [];
      state.anchorIndex += 1;
      healPlayer(1, anchor.x, anchor.y - 25);
      state.phaseHealth = Math.max(
        0,
        100 - (state.anchorIndex / 3) * 100
      );
      stage.dataset.anchors = `${state.anchorIndex}/3`;
      updateHud(true);
      if (state.anchorIndex >= 3) {
        beginTransition(world);
      } else {
        state.anchorDelay = 1.18;
        setObjective(
          `Anchor ${state.anchorIndex} severed. Follow the next forming line.`
        );
      }
    }

    function damageSeal(seal, amount, world) {
      if (!seal || !state.seals.includes(seal)) {
        return;
      }
      seal.health -= amount;
      seal.hitFlash = 1;
      addParticles(seal.x, seal.y, "#fff048", 6, 100);
      onCue("enemy-hit", 0.68);
      if (seal.health > 0) {
        return;
      }
      state.seals = state.seals.filter((candidate) => candidate !== seal);
      addParticles(seal.x, seal.y, "#ff8f26", 17, 175);
      onCue("anchor-break", 0.45);
      setObjective(
        state.seals.length
          ? "One seal remains. Climb to it."
          : `The anchor is exposed. Sever anchor ${state.anchorIndex + 1}.`
      );
      updateHud(true);
    }

    function update(deltaTime, world) {
      if (!world) {
        return;
      }
      state.world = world;
      if (!state.active) {
        if (state.victoryTime > 0) {
          state.victoryTime += deltaTime;
          stage.dataset.victoryTime = state.victoryTime.toFixed(3);
          state.victoryFragments.forEach((fragment) => {
            if (state.victoryTime < fragment.delay) {
              return;
            }
            fragment.life -= deltaTime;
            fragment.vy += 190 * deltaTime;
            fragment.x += fragment.vx * deltaTime;
            fragment.y += fragment.vy * deltaTime;
            fragment.rotation += fragment.rotationSpeed * deltaTime;
          });
          state.victoryFragments = state.victoryFragments.filter(
            (fragment) => fragment.life > 0
          );
          state.victoryRays.forEach((ray, index) => {
            if (!state.crackCues[index] && state.victoryTime >= ray.delay) {
              state.crackCues[index] = true;
              onCue("crack-light", 0.64 + index * 0.09);
            }
          });
          if (
            !state.splinterCuePlayed &&
            state.victoryTime >= VICTORY_SPLINTER_AT
          ) {
            state.splinterCuePlayed = true;
            onCue("splinter", 1);
          }
          if (state.victoryTime > VICTORY_RESULTS_AT && !state.resultShown) {
            state.resultShown = true;
            stage.dataset.resultState = "shown";
            if (resultPanel) {
              resultPanel.setAttribute("aria-hidden", "false");
            }
          }
          if (state.victoryTime > VICTORY_DURATION) {
            state.victoryTime = VICTORY_DURATION;
          }
        }
        updateParticles(deltaTime);
        return;
      }
      state.encounterElapsed += deltaTime;
      state.phaseTime += deltaTime;
      state.transitionPulse = Math.max(
        0,
        state.transitionPulse - deltaTime * 2.8
      );
      state.player.invulnerable = Math.max(
        0,
        state.player.invulnerable - deltaTime
      );
      state.player.hitFlash = Math.max(
        0,
        state.player.hitFlash - deltaTime * 5.2
      );
      state.player.attackCooldown = Math.max(
        0,
        state.player.attackCooldown - deltaTime
      );
      state.player.rangedCooldown = Math.max(
        0,
        state.player.rangedCooldown - deltaTime
      );
      state.player.attackTime = Math.max(
        0,
        state.player.attackTime - deltaTime
      );
      state.pointer.pulse = Math.max(0, state.pointer.pulse - deltaTime);
      state.pointer.cooldown = Math.max(
        0,
        state.pointer.cooldown - deltaTime
      );
      if (state.assistedTarget) {
        state.assistedTarget.life -= deltaTime;
        if (state.assistedTarget.life <= 0) {
          state.assistedTarget = null;
        }
      }

      if (state.player.thread < MAX_THREAD) {
        state.player.threadTimer += deltaTime;
        if (state.player.threadTimer >= 0.92) {
          state.player.thread += 1;
          state.player.threadTimer = 0;
          onCue("thread-ready", state.player.thread / MAX_THREAD);
          updateHud(true);
        }
      } else {
        state.player.threadTimer = 0;
      }

      if (state.player.deathTimer > 0) {
        state.player.deathTimer = Math.max(
          0,
          state.player.deathTimer - deltaTime
        );
        updateParticles(deltaTime);
        if (state.player.deathTimer === 0) {
          state.player.health = MAX_PLAYER_HEALTH;
          state.player.thread = MAX_THREAD;
          state.player.invulnerable = 2.2;
          enterPhase(1, world, true);
        }
        return;
      }

      if (state.transitionTime > 0) {
        state.transitionTime = Math.max(0, state.transitionTime - deltaTime);
        updateParticles(deltaTime);
        if (state.transitionTime === 0) {
          enterPhase(state.phase + 1, world);
        }
        return;
      }

      state.attackTimer -= deltaTime;
      if (state.attackTimer <= 0) {
        runPhasePattern(world);
      }

      if (state.phase === 1) {
        updateMinions(deltaTime, world);
      } else if (state.phase === 2) {
        updateAnchors(deltaTime, world);
        updateDebris(deltaTime, world);
      }

      updateBeams(deltaTime, world);
      updateZones(deltaTime, world);
      updateShockwaves(deltaTime, world);
      updateProjectiles(deltaTime, world);
      updatePlayerShots(deltaTime, world);
      updateParticles(deltaTime);
      updateHud();

      stage.dataset.projectiles = String(state.projectiles.length);
      stage.dataset.objective = state.objective;
    }

    function resolveAttackDirection(input, player) {
      if (input?.y < -0.35) {
        return { x: 0, y: -1 };
      }
      if (input?.y > 0.35 && !player.grounded) {
        return { x: 0, y: 1 };
      }
      const x = Math.sign(input?.x || player.facing || 1);
      return { x, y: 0 };
    }

    function meleeAttack(input, world) {
      if (
        !state.active ||
        state.transitionTime > 0 ||
        state.player.deathTimer > 0 ||
        state.player.attackCooldown > 0
      ) {
        return false;
      }
      state.world = world;
      const player = world.player;
      const direction = resolveAttackDirection(input, player);
      const origin = {
        x: player.x + direction.x * 5,
        y: player.y - 34 + direction.y * 4
      };
      const reach = direction.y ? 68 : 76;
      const end = {
        x: origin.x + direction.x * reach,
        y: origin.y + direction.y * reach
      };
      state.player.attackCooldown = 0.19;
      state.player.attackTime = 0.16;
      state.player.combo = (state.player.combo + 1) % 3;
      state.slashes.push({
        origin,
        end,
        direction,
        life: 0.16,
        maxLife: 0.16,
        combo: state.player.combo
      });
      onCue("melee", state.player.combo / 3);

      state.minions.forEach((minion) => {
        if (
          !minion.dead &&
          minion.assembly >= 0.82 &&
          distanceToSegment(minion, origin, end) <
            minion.radius + 16
        ) {
          minion.health -= 18;
          minion.hitFlash = 1;
          addParticles(minion.x, minion.y, "#fff048", 8, 125);
          onCue("enemy-hit", 0.8);
          if (minion.health <= 0) {
            killMinion(minion, world);
          }
        }
      });

      const anchor = state.anchors[0];
      if (
        anchor &&
        distanceToSegment(
          { x: anchor.x, y: anchor.y - 28 },
          origin,
          end
        ) < anchor.radius + 16
      ) {
        damageAnchor(anchor, 22, world);
      }

      state.seals.slice().forEach((seal) => {
        if (
          distanceToSegment(seal, origin, end) <
          seal.radius + 15
        ) {
          damageSeal(seal, 22, world);
        }
      });

      state.debris.forEach((debris) => {
        if (
          debris.assembly >= 0.72 &&
          distanceToSegment(debris, origin, end) <
            debris.size * 0.62 + 14
        ) {
          debris.health -= 22;
          if (debris.health <= 0) {
            debris.dead = true;
            addParticles(debris.x, debris.y, "#a9b4bd", 12, 145);
            onCue("debris-break", debris.heavy ? 1 : 0.65);
            if (direction.y > 0 && !player.grounded) {
              player.vy = -430;
              player.airDashUsed = false;
            }
          }
        }
      });

      state.projectiles.forEach((projectile) => {
        if (
          !projectile.friendly &&
          distanceToSegment(projectile, origin, end) <
            projectile.radius + 13
        ) {
          if (
            state.phase === 3 &&
            projectile.kind === "ricochet" &&
            projectile.age >= 0.18
          ) {
            reflectProjectile(projectile, world, projectile);
          } else {
            projectile.life = 0;
            addParticles(
              projectile.x,
              projectile.y,
              "#fff048",
              5,
              90
            );
          }
        }
      });
      return true;
    }

    function getAssistedTarget(input, world, origin) {
      const player = world.player;
      const inputY = input?.y || 0;
      const inputX = input?.x || 0;
      const facing = Math.sign(inputX || player.facing || 1);
      const candidates = [];
      state.minions.forEach((minion) => {
        if (!minion.dead && minion.assembly >= 0.72) {
          candidates.push({
            id: minion.id,
            kind: "minion",
            x: minion.x,
            y: minion.y,
            priority: -180
          });
        }
      });
      state.seals.forEach((seal) => candidates.push({
        id: seal.id,
        kind: "seal",
        x: seal.x,
        y: seal.y,
        priority: -520
      }));
      state.anchors.forEach((anchor) => candidates.push({
        id: anchor.id,
        kind: "anchor",
        x: anchor.x,
        y: anchor.y - 28,
        priority: state.seals.length ? 240 : -340
      }));
      state.debris.forEach((debris, index) => {
        if (!debris.dead && debris.assembly >= 0.7) {
          candidates.push({
            id: `debris-${index}`,
            kind: "debris",
            x: debris.x,
            y: debris.y,
            priority: 80
          });
        }
      });
      if (
        (state.phase === 1 && state.wardOpen) ||
        state.phase === 3
      ) {
        const eye = getEye(world);
        candidates.push({
          id: "eye",
          kind: "eye",
          x: eye.x,
          y: eye.y,
          priority: -260
        });
      }

      let best = null;
      let bestScore = Infinity;
      candidates.forEach((target) => {
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 760) {
          return;
        }
        if (inputY < -0.35 && dy > 42) {
          return;
        }
        if (inputY > 0.35 && dy < -42) {
          return;
        }
        if (Math.abs(inputY) <= 0.35 && dx * facing < -24) {
          return;
        }
        const desiredAngle = inputY < -0.35
          ? -Math.PI / 2
          : inputY > 0.35
            ? Math.PI / 2
            : facing > 0 ? 0 : Math.PI;
        const targetAngle = Math.atan2(dy, dx);
        const angleError = Math.abs(Math.atan2(
          Math.sin(targetAngle - desiredAngle),
          Math.cos(targetAngle - desiredAngle)
        ));
        const score = distance + angleError * 185 + target.priority;
        if (score < bestScore) {
          bestScore = score;
          best = target;
        }
      });
      return best;
    }

    function rangedAttack(input, world) {
      if (
        !state.active ||
        state.transitionTime > 0 ||
        state.player.deathTimer > 0 ||
        state.player.rangedCooldown > 0 ||
        state.player.thread <= 0
      ) {
        return false;
      }
      state.world = world;
      const player = world.player;
      const rawDirection = resolveAttackDirection(input, player);
      const origin = {
        x: player.x + rawDirection.x * 12,
        y: player.y - 35 + rawDirection.y * 7
      };
      const target = getAssistedTarget(input, world, origin);
      const direction = target
        ? normalizeVector(
            target.x - origin.x,
            target.y - origin.y,
            rawDirection.x,
            rawDirection.y
          )
        : rawDirection;
      state.assistedTarget = target
        ? { ...target, life: 0.28 }
        : null;
      state.player.thread -= 1;
      state.player.threadTimer = 0;
      state.player.rangedCooldown = 0.32;
      state.playerShots.push({
        x: origin.x,
        y: origin.y,
        vx: direction.x * 560,
        vy: direction.y * 560,
        radius: 4,
        damage: 11,
        life: 1.9,
        trail: [],
        targetId: target?.id || "",
        targetKind: target?.kind || ""
      });
      addParticles(origin.x, origin.y, "#69ddff", 4, 72);
      onCue("thread-shot", state.player.thread / MAX_THREAD);
      updateHud(true);
      return true;
    }

    function pointerMove(x, y) {
      state.pointer.x = x;
      state.pointer.y = y;
    }

    function pointerDown(x, y) {
      if (
        !state.active ||
        state.phase !== 3 ||
        state.transitionTime > 0 ||
        state.pointer.cooldown > 0
      ) {
        return false;
      }
      state.pointer.x = x;
      state.pointer.y = y;
      state.pointer.pulse = DEFLECTOR_PULSE;
      state.pointer.cooldown = DEFLECTOR_COOLDOWN;
      stage.dataset.parryState = "armed";
      onCue("parry-pulse", 1);
      return true;
    }

    function playerFell(world) {
      if (!state.active) {
        return;
      }
      triggerPlayerDeath("fall", world || state.world);
    }

    function start(world) {
      state.active = true;
      state.victoryTime = 0;
      state.resultShown = false;
      delete stage.dataset.resultState;
      state.victoryFragments = [];
      state.victoryRays = [];
      state.encounterElapsed = 0;
      state.heartsLost = 0;
      state.world = world;
      state.player.health = MAX_PLAYER_HEALTH;
      state.player.thread = MAX_THREAD;
      state.player.threadTimer = 0;
      state.player.invulnerable = 2.2;
      state.player.deathTimer = 0;
      state.pointer.pulse = 0;
      state.pointer.cooldown = 0;
      state.particles = [];
      enterPhase(1, world, true);
      stage.classList.add("has-combat");
    }

    function stop() {
      state.active = false;
      clearCombatEntities(false);
      onCursorMode(false);
      onDeathMode(false);
      onVictoryMode(false);
      state.victoryTime = 0;
      state.resultShown = false;
      delete stage.dataset.resultState;
      state.victoryFragments = [];
      state.victoryRays = [];
      if (resultPanel) {
        resultPanel.setAttribute("aria-hidden", "true");
      }
      stage.classList.remove("has-combat");
      stage.removeAttribute("data-phase");
      stage.removeAttribute("data-phase-state");
      stage.removeAttribute("data-phase-construct");
      stage.removeAttribute("data-projectiles");
      stage.removeAttribute("data-minions");
      stage.removeAttribute("data-anchors");
      stage.removeAttribute("data-objective");
      stage.removeAttribute("data-victory-time");
    }

    function drawAssemblyLines(context, entity, vertices, alpha) {
      const eye = getEye();
      context.save();
      context.strokeStyle = `rgb(174 187 198 / ${alpha})`;
      context.lineWidth = 0.9;
      context.setLineDash([3, 7]);
      vertices.forEach((vertex, index) => {
        context.beginPath();
        context.moveTo(
          eye.x + Math.sin(index * 2.4 + state.phaseTime) * 6,
          eye.y + Math.cos(index * 1.7 + state.phaseTime) * 4
        );
        context.lineTo(vertex.x, vertex.y);
        context.stroke();
      });
      context.restore();
    }

    function drawGazeCrown(context) {
      if (state.phase !== 3 || !state.active || !state.world) {
        return;
      }
      const eye = getEye();
      const emitters = getGazeCrownEmitters();
      const assembly = easeOutCubic(clamp(state.phaseTime / 1.25, 0, 1));
      const pulse = 0.72 + Math.sin(state.phaseTime * 4.4) * 0.18;

      context.save();
      context.globalAlpha = assembly;
      context.strokeStyle = `rgb(255 240 72 / ${0.18 + pulse * 0.18})`;
      context.lineWidth = 1;
      context.setLineDash([4, 8]);
      emitters.forEach((emitter) => {
        context.beginPath();
        context.moveTo(eye.x, eye.y);
        context.lineTo(emitter.x, emitter.y);
        context.stroke();
      });
      context.beginPath();
      context.moveTo(emitters[0].x, emitters[0].y);
      context.lineTo(emitters[1].x, emitters[1].y);
      context.lineTo(emitters[2].x, emitters[2].y);
      context.stroke();
      context.setLineDash([]);

      context.translate(eye.x, eye.y);
      context.scale(1, 0.58);
      [58, 78, 98].forEach((radius, ringIndex) => {
        context.strokeStyle = ringIndex === 1
          ? `rgb(255 31 45 / ${0.2 + pulse * 0.18})`
          : `rgb(171 184 195 / ${0.18 + pulse * 0.1})`;
        context.lineWidth = ringIndex === 1 ? 1.45 : 0.9;
        for (let segment = 0; segment < 8; segment += 1) {
          const start = segment * TAU / 8 + ringIndex * 0.09;
          context.beginPath();
          context.arc(0, 0, radius * assembly, start, start + 0.42);
          context.stroke();
        }
      });
      context.restore();

      emitters.forEach((emitter, index) => {
        const size = (15 + (index === 1 ? 3 : 0)) * assembly;
        const vertices = [
          { x: emitter.x, y: emitter.y - size },
          { x: emitter.x + size * 0.76, y: emitter.y },
          { x: emitter.x, y: emitter.y + size },
          { x: emitter.x - size * 0.76, y: emitter.y }
        ];
        if (assembly < 0.98) {
          drawAssemblyLines(context, emitter, vertices, 0.42 * assembly);
        }
        context.save();
        context.translate(emitter.x, emitter.y);
        context.rotate(
          emitter.rotation + Math.sin(state.phaseTime * 2.2 + index) * 0.035
        );
        context.fillStyle = "rgb(8 13 21 / 94%)";
        context.strokeStyle = index === state.patternIndex % emitters.length
          ? "rgb(255 240 72 / 92%)"
          : "rgb(184 196 206 / 82%)";
        context.lineWidth = index === state.patternIndex % emitters.length
          ? 1.8
          : 1.1;
        polygonPath(context, [
          { x: 0, y: -size },
          { x: size * 0.76, y: 0 },
          { x: 0, y: size },
          { x: -size * 0.76, y: 0 }
        ]);
        context.fill();
        context.stroke();
        context.strokeStyle = "rgb(255 31 45 / 76%)";
        context.beginPath();
        context.moveTo(-size * 0.44, 0);
        context.lineTo(size * 0.44, 0);
        context.moveTo(0, -size * 0.58);
        context.lineTo(0, size * 0.58);
        context.stroke();
        context.strokeStyle = `rgb(255 240 72 / ${0.44 + pulse * 0.34})`;
        context.beginPath();
        context.arc(0, 0, size * 0.27, 0, TAU);
        context.stroke();
        [-1, 1].forEach((side) => {
          context.beginPath();
          context.moveTo(side * size * 0.76, 0);
          context.lineTo(side * size * 1.28, -size * 0.3);
          context.lineTo(side * size * 1.08, size * 0.34);
          context.stroke();
        });
        context.restore();
      });
    }

    function drawMinion(context, minion) {
      if (minion.dead || minion.assemblyDelay > 0) {
        return;
      }
      const alpha = clamp(minion.assembly * 1.4, 0, 1);
      const size = minion.radius * easeOutCubic(minion.assembly);
      const vertices = [
        { x: minion.x, y: minion.y - size },
        { x: minion.x + size * 0.72, y: minion.y },
        { x: minion.x, y: minion.y + size },
        { x: minion.x - size * 0.72, y: minion.y }
      ];
      if (minion.assembly < 1) {
        drawAssemblyLines(context, minion, vertices, 0.34 * alpha);
      }
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = minion.hitFlash > 0
        ? "#fff048"
        : "rgb(177 189 199 / 86%)";
      context.fillStyle = "rgb(9 14 22 / 88%)";
      context.lineWidth = minion.hitFlash > 0 ? 2 : 1.15;
      polygonPath(context, vertices);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(minion.x, minion.y, size * 0.34, 0, TAU);
      context.strokeStyle = minion.role === "artillery"
        ? "rgb(255 143 38 / 88%)"
        : minion.role === "warden"
          ? "rgb(255 240 72 / 82%)"
          : "rgb(255 31 45 / 88%)";
      context.stroke();
      context.beginPath();
      if (minion.role === "artillery") {
        context.moveTo(minion.x - size * 0.58, minion.y);
        context.lineTo(minion.x + size * 0.58, minion.y);
      } else if (minion.role === "warden") {
        context.arc(minion.x, minion.y, size * 0.58, 0, TAU);
      } else {
        context.moveTo(minion.x, minion.y - size * 0.72);
        context.lineTo(minion.x, minion.y + size * 0.72);
      }
      context.stroke();

      const health = clamp(minion.health / minion.maxHealth, 0, 1);
      context.strokeStyle = "rgb(255 31 45 / 56%)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(
        minion.x,
        minion.y,
        size + 5,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * health
      );
      context.stroke();
      context.restore();
    }

    function drawAnchor(context, anchor) {
      const progress = easeOutCubic(anchor.assembly);
      const y = anchor.y;
      const height = 54 * progress;
      const width = 24 * progress;
      const vertices = [
        { x: anchor.x, y: y - height },
        { x: anchor.x + width, y: y - height * 0.64 },
        { x: anchor.x + width * 0.62, y: y - 7 },
        { x: anchor.x, y },
        { x: anchor.x - width * 0.62, y: y - 7 },
        { x: anchor.x - width, y: y - height * 0.64 }
      ];
      if (anchor.assembly < 1) {
        drawAssemblyLines(
          context,
          anchor,
          vertices,
          0.42 * anchor.assembly
        );
      }
      context.save();
      context.strokeStyle = anchor.hitFlash > 0
        ? "#fff048"
        : "rgb(184 196 206 / 90%)";
      context.fillStyle = "rgb(8 13 21 / 94%)";
      context.lineWidth = anchor.hitFlash > 0 ? 2.2 : 1.2;
      polygonPath(context, vertices);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(anchor.x - width * 0.58, y - height * 0.43);
      context.lineTo(anchor.x + width * 0.58, y - height * 0.43);
      context.moveTo(anchor.x, y - height);
      context.lineTo(anchor.x, y - 8);
      context.strokeStyle = "rgb(255 31 45 / 62%)";
      context.stroke();

      const health = clamp(anchor.health / anchor.maxHealth, 0, 1);
      context.strokeStyle = "#fff048";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(anchor.x - width, y + 8);
      context.lineTo(anchor.x - width + width * 2 * health, y + 8);
      context.stroke();
      context.restore();
    }

    function drawSeal(context, seal) {
      const pulse = 1 + Math.sin(seal.pulse) * 0.08;
      context.save();
      context.translate(seal.x, seal.y);
      context.rotate(Math.PI / 4 + seal.pulse * 0.08);
      context.scale(pulse, pulse);
      context.fillStyle = "rgb(8 13 21 / 94%)";
      context.strokeStyle = seal.hitFlash > 0
        ? "#fff048"
        : "rgb(255 143 38 / 88%)";
      context.lineWidth = seal.hitFlash > 0 ? 2.2 : 1.25;
      context.fillRect(-10, -10, 20, 20);
      context.strokeRect(-10, -10, 20, 20);
      context.beginPath();
      context.moveTo(-5, 0);
      context.lineTo(5, 0);
      context.moveTo(0, -5);
      context.lineTo(0, 5);
      context.strokeStyle = "rgb(255 31 45 / 78%)";
      context.stroke();
      context.restore();
    }

    function drawPlatform(context, platform) {
      const right = platform.x + platform.width;
      context.save();
      context.strokeStyle = "rgb(159 173 185 / 58%)";
      context.lineWidth = 1.15;
      context.beginPath();
      context.moveTo(platform.x + 10, platform.y);
      context.lineTo(right - 10, platform.y);
      context.stroke();
      context.strokeStyle = "rgb(255 31 45 / 34%)";
      context.beginPath();
      context.moveTo(platform.x, platform.y + 8);
      context.lineTo(platform.x + 10, platform.y);
      context.moveTo(right, platform.y + 8);
      context.lineTo(right - 10, platform.y);
      context.stroke();
      if (platform.id.startsWith("gaze-")) {
        const center = platform.x + platform.width * 0.5;
        const quarter = platform.width * 0.24;
        context.strokeStyle = "rgb(255 240 72 / 38%)";
        context.beginPath();
        context.moveTo(center - quarter, platform.y + 4);
        context.lineTo(center - quarter * 0.54, platform.y + 11);
        context.lineTo(center, platform.y + 11);
        context.lineTo(center + quarter * 0.54, platform.y + 11);
        context.lineTo(center + quarter, platform.y + 4);
        context.stroke();
        context.translate(center, platform.y + 11);
        context.rotate(Math.PI / 4);
        context.strokeRect(-4, -4, 8, 8);
      }
      context.restore();
    }

    function drawZone(context, zone) {
      const progress = clamp(zone.age / zone.telegraph, 0, 1);
      const active = zone.age >= zone.telegraph;
      context.save();
      if (zone.kind === "floor-surge") {
        const left = zone.x - zone.radius;
        const width = zone.radius * 2;
        context.fillStyle = active
          ? `rgb(255 31 45 / ${0.09 + Math.sin(zone.age * 35) * 0.035})`
          : "rgb(255 240 72 / 5%)";
        context.fillRect(left, zone.y - 14, width, 18);
        context.strokeStyle = active
          ? "rgb(255 31 45 / 88%)"
          : "rgb(255 240 72 / 52%)";
        context.setLineDash(active ? [] : [7, 9]);
        context.lineWidth = active ? 1.6 : 1;
        context.beginPath();
        const step = 28;
        for (let x = left; x <= left + width; x += step) {
          const distanceFromCenter = Math.abs(x + step * 0.5 - zone.x);
          const tier = 1 - clamp(distanceFromCenter / zone.radius, 0, 1);
          const height = active ? 16 + tier * 25 : 5 + tier * 6;
          context.moveTo(x, zone.y);
          context.lineTo(x + step * 0.5, zone.y - height);
          context.lineTo(x + step, zone.y);
        }
        context.stroke();
        context.setLineDash([]);
        context.strokeStyle = active
          ? "rgb(255 240 72 / 48%)"
          : "rgb(171 184 195 / 28%)";
        context.beginPath();
        context.moveTo(left, zone.y - 8);
        context.lineTo(zone.x - 34, zone.y - 8);
        context.lineTo(zone.x - 20, zone.y - 18);
        context.lineTo(zone.x, zone.y - 8);
        context.lineTo(zone.x + 20, zone.y - 18);
        context.lineTo(zone.x + 34, zone.y - 8);
        context.lineTo(left + width, zone.y - 8);
        context.stroke();
      } else {
        context.translate(zone.x, zone.y);
        context.scale(1, 0.34);
        context.fillStyle = active
          ? "rgb(255 31 45 / 17%)"
          : "rgb(255 240 72 / 4%)";
        context.strokeStyle = active
          ? "rgb(255 31 45 / 82%)"
          : "rgb(255 240 72 / 52%)";
        context.lineWidth = active ? 4 : 2.4;
        context.setLineDash(active ? [] : [7, 10]);
        const radius = zone.radius * (0.72 + progress * 0.28);
        const vertices = Array.from({ length: 8 }, (_, index) => {
          const angle = -Math.PI / 2 + index * TAU / 8;
          return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
          };
        });
        polygonPath(context, vertices);
        context.fill();
        context.stroke();
        context.setLineDash([]);
        context.lineWidth = 1.4;
        context.strokeStyle = active
          ? "rgb(255 240 72 / 44%)"
          : "rgb(171 184 195 / 32%)";
        polygonPath(context, vertices.map((vertex) => ({
          x: vertex.x * 0.58,
          y: vertex.y * 0.58
        })));
        context.stroke();
        context.beginPath();
        context.moveTo(-radius * 0.34, 0);
        context.lineTo(radius * 0.34, 0);
        context.moveTo(0, -radius * 0.34);
        context.lineTo(0, radius * 0.34);
        context.stroke();
      }
      context.restore();
    }

    function getDebrisVertices(debris) {
      const points = 6;
      return Array.from({ length: points }, (_, index) => {
        const angle = debris.rotation + (index / points) * TAU;
        const irregularity = 0.62 + ((index * 17 + 3) % 7) / 16;
        return {
          x: debris.x + Math.cos(angle) * debris.size * irregularity,
          y: debris.y + Math.sin(angle) * debris.size * irregularity
        };
      });
    }

    function drawDebris(context, debris) {
      const vertices = getDebrisVertices(debris);
      if (!debris.falling) {
        drawAssemblyLines(
          context,
          debris,
          vertices,
          0.38 * debris.assembly
        );
        context.save();
        context.strokeStyle = `rgb(255 31 45 / ${0.18 + debris.assembly * 0.42})`;
        context.setLineDash([2, 8]);
        context.beginPath();
        context.moveTo(debris.targetX, debris.y + debris.size + 8);
        context.lineTo(debris.targetX, state.world.groundY);
        context.stroke();
        context.restore();
      }
      context.save();
      context.fillStyle = debris.heavy
        ? "rgb(25 30 38 / 94%)"
        : "rgb(18 24 32 / 92%)";
      context.strokeStyle = debris.heavy
        ? "rgb(255 143 38 / 88%)"
        : "rgb(171 183 193 / 80%)";
      context.lineWidth = debris.heavy ? 1.8 : 1.1;
      polygonPath(context, vertices);
      context.fill();
      context.stroke();
      context.restore();
    }

    function drawBeam(context, beam) {
      const active = beam.age >= beam.telegraph;
      const expired = beam.age > beam.telegraph + beam.active;
      if (expired) {
        return;
      }
      context.save();
      context.beginPath();
      context.moveTo(beam.x1, beam.y1);
      context.lineTo(beam.targetX, beam.targetY);
      if (active) {
        const pulse = 0.72 + Math.sin(beam.age * 48) * 0.18;
        context.strokeStyle = `rgb(255 31 45 / ${pulse})`;
        context.lineWidth = beam.width;
        context.shadowColor = "#ff1f2d";
        context.shadowBlur = 12;
      } else {
        context.strokeStyle = "rgb(255 240 72 / 46%)";
        context.lineWidth = 1;
        context.setLineDash([5, 9]);
      }
      context.stroke();
      context.restore();
    }

    function drawProjectile(context, projectile) {
      context.save();
      projectile.trail.forEach((point) => {
        context.globalAlpha = clamp(point.life / 0.15, 0, 1) * 0.24;
        context.fillStyle = projectile.color;
        if (projectile.kind === "ricochet") {
          context.save();
          context.translate(point.x, point.y);
          context.rotate(Math.PI / 4 + projectile.age * 2.8);
          context.fillRect(
            -projectile.radius * 0.42,
            -projectile.radius * 0.42,
            projectile.radius * 0.84,
            projectile.radius * 0.84
          );
          context.restore();
        } else {
          context.beginPath();
          context.arc(
            point.x,
            point.y,
            projectile.radius * 0.62,
            0,
            TAU
          );
          context.fill();
        }
      });
      context.globalAlpha = 1;
      context.translate(projectile.x, projectile.y);
      context.rotate(Math.atan2(projectile.vy, projectile.vx));
      context.fillStyle = projectile.color;
      context.strokeStyle = projectile.friendly
        ? "rgb(220 248 255 / 92%)"
        : "rgb(255 143 38 / 82%)";
      context.lineWidth = 1;
      if (projectile.kind === "needle") {
        polygonPath(context, [
          { x: projectile.radius * 1.8, y: 0 },
          { x: -projectile.radius, y: projectile.radius * 0.58 },
          { x: -projectile.radius * 0.56, y: 0 },
          { x: -projectile.radius, y: -projectile.radius * 0.58 }
        ]);
      } else if (projectile.kind === "ricochet") {
        context.rotate(projectile.age * 3.2);
        polygonPath(context, [
          { x: projectile.radius * 1.42, y: 0 },
          { x: 0, y: projectile.radius },
          { x: -projectile.radius * 1.42, y: 0 },
          { x: 0, y: -projectile.radius }
        ]);
      } else if (projectile.kind === "splitter") {
        polygonPath(context, [
          { x: projectile.radius * 1.62, y: 0 },
          { x: projectile.radius * 0.28, y: projectile.radius * 0.72 },
          { x: -projectile.radius * 0.24, y: projectile.radius * 1.08 },
          { x: -projectile.radius, y: projectile.radius * 0.48 },
          { x: -projectile.radius * 0.62, y: 0 },
          { x: -projectile.radius, y: -projectile.radius * 0.48 },
          { x: -projectile.radius * 0.24, y: -projectile.radius * 1.08 },
          { x: projectile.radius * 0.28, y: -projectile.radius * 0.72 }
        ]);
      } else if (projectile.kind === "rupture") {
        polygonPath(context, [
          { x: projectile.radius * 1.7, y: 0 },
          { x: projectile.radius * 0.32, y: projectile.radius * 0.72 },
          { x: -projectile.radius * 0.62, y: projectile.radius },
          { x: -projectile.radius, y: 0 },
          { x: -projectile.radius * 0.62, y: -projectile.radius },
          { x: projectile.radius * 0.32, y: -projectile.radius * 0.72 }
        ]);
      } else {
        context.beginPath();
        context.arc(0, 0, projectile.radius, 0, TAU);
      }
      context.fill();
      context.stroke();
      if (
        projectile.kind === "ricochet" ||
        projectile.kind === "splitter" ||
        projectile.kind === "rupture"
      ) {
        context.strokeStyle = projectile.friendly
          ? "rgb(232 251 255 / 88%)"
          : "rgb(255 240 72 / 72%)";
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(-projectile.radius * 0.56, 0);
        context.lineTo(projectile.radius * 0.56, 0);
        context.moveTo(0, -projectile.radius * 0.46);
        context.lineTo(0, projectile.radius * 0.46);
        context.stroke();
      }
      context.restore();
    }

    function drawShockwave(context, shockwave) {
      context.save();
      context.translate(shockwave.x, shockwave.y);
      const direction = Math.sign(shockwave.vx);
      context.strokeStyle = "rgb(255 143 38 / 76%)";
      context.fillStyle = "rgb(255 31 45 / 10%)";
      context.lineWidth = 1.2;
      polygonPath(context, [
        { x: direction * 19, y: -2 },
        { x: direction * 5, y: -17 },
        { x: -direction * 10, y: -4 },
        { x: -direction * 15, y: 0 }
      ]);
      context.fill();
      context.stroke();
      context.restore();
    }

    function drawPlayerShot(context, shot) {
      const angle = Math.atan2(shot.vy, shot.vx);
      context.save();
      context.translate(shot.x, shot.y);
      context.rotate(angle);
      context.strokeStyle = "#69ddff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(-18, 0);
      context.lineTo(8, 0);
      context.stroke();
      context.fillStyle = "#e8fbff";
      context.beginPath();
      context.arc(8, 0, 2.4, 0, TAU);
      context.fill();
      context.restore();
    }

    function drawSlash(context, slash) {
      const progress = 1 - slash.life / slash.maxLife;
      const angle = Math.atan2(
        slash.direction.y,
        slash.direction.x
      );
      const radius = distanceBetween(slash.origin, slash.end);
      const sweep = lerp(-0.74, 0.72, easeOutCubic(progress));
      context.save();
      context.translate(slash.origin.x, slash.origin.y);
      context.rotate(angle);
      context.strokeStyle = `rgb(232 251 255 / ${1 - progress})`;
      context.lineWidth = 2.4 - progress;
      context.shadowColor = "#69ddff";
      context.shadowBlur = 7;
      context.beginPath();
      context.arc(0, 0, radius, sweep - 0.6, sweep + 0.2);
      context.stroke();

      context.rotate(sweep - 0.05);
      context.shadowBlur = 4;
      context.strokeStyle = `rgb(224 239 246 / ${1 - progress * 0.62})`;
      context.lineWidth = 1.35;
      context.beginPath();
      context.moveTo(7, 0);
      context.lineTo(radius * 0.94, 0);
      context.stroke();
      context.fillStyle = "#69ddff";
      context.rotate(Math.PI / 4);
      context.fillRect(3.6, -3.6, 7.2, 7.2);
      context.restore();
    }

    function drawPointerField(context) {
      if (state.phase !== 3 || !state.active) {
        return;
      }
      const cooldownProgress = 1 - state.pointer.cooldown / DEFLECTOR_COOLDOWN;
      context.save();
      context.translate(state.pointer.x, state.pointer.y);
      context.setLineDash([]);
      const charge = clamp(cooldownProgress, 0, 1);
      const vertices = Array.from({ length: 8 }, (_, index) => {
        const angle = -Math.PI / 2 + index * TAU / 8;
        return {
          x: Math.cos(angle) * state.pointer.radius,
          y: Math.sin(angle) * state.pointer.radius
        };
      });
      vertices.forEach((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length];
        const sideProgress = clamp(charge * 8 - index, 0, 1);
        context.strokeStyle = sideProgress > 0
          ? `rgb(105 221 255 / ${0.34 + sideProgress * 0.5})`
          : "rgb(133 143 153 / 24%)";
        context.lineWidth = sideProgress >= 1 ? 1.8 : 1;
        context.beginPath();
        context.moveTo(vertex.x, vertex.y);
        context.lineTo(
          lerp(vertex.x, next.x, sideProgress),
          lerp(vertex.y, next.y, sideProgress)
        );
        context.stroke();
      });
      context.strokeStyle = state.pointer.cooldown > 0
        ? "rgb(133 143 153 / 32%)"
        : "rgb(105 221 255 / 66%)";
      context.lineWidth = 1;
      vertices.forEach((vertex) => {
        const direction = normalizeVector(vertex.x, vertex.y);
        context.beginPath();
        context.moveTo(vertex.x, vertex.y);
        context.lineTo(
          vertex.x + direction.x * 8,
          vertex.y + direction.y * 8
        );
        context.stroke();
      });
      context.rotate(Math.PI / 4);
      context.strokeRect(-7, -7, 14, 14);
      context.rotate(-Math.PI / 4);
      if (state.pointer.pulse > 0) {
        const pulseProgress = 1 - state.pointer.pulse / DEFLECTOR_PULSE;
        context.strokeStyle = `rgb(105 221 255 / ${1 - pulseProgress})`;
        context.lineWidth = 2;
        const pulseRadius = lerp(
          12,
          state.pointer.radius,
          easeOutCubic(pulseProgress)
        );
        polygonPath(context, Array.from({ length: 8 }, (_, index) => {
          const angle = -Math.PI / 2 + index * TAU / 8;
          return {
            x: Math.cos(angle) * pulseRadius,
            y: Math.sin(angle) * pulseRadius
          };
        }));
        context.stroke();
      }
      context.restore();
    }

    function drawBack(context) {
      if (!state.active && stage.dataset.phaseState !== "defeated") {
        return;
      }
      drawGazeCrown(context);
      state.beams.forEach((beam) => drawBeam(context, beam));
      state.platforms.forEach((platform) => drawPlatform(context, platform));
      state.zones.forEach((zone) => drawZone(context, zone));
      state.minions.forEach((minion) => drawMinion(context, minion));
      state.anchors.forEach((anchor) => drawAnchor(context, anchor));
      state.seals.forEach((seal) => drawSeal(context, seal));
      state.debris.forEach((debris) => drawDebris(context, debris));
      state.shockwaves.forEach(
        (shockwave) => drawShockwave(context, shockwave)
      );
      state.projectiles.forEach(
        (projectile) => drawProjectile(context, projectile)
      );
      state.playerShots.forEach((shot) => drawPlayerShot(context, shot));
    }

    function drawFront(context) {
      if (
        !state.active &&
        !state.particles.length &&
        state.victoryTime <= 0
      ) {
        return;
      }
      state.slashes.forEach((slash) => drawSlash(context, slash));
      state.particles.forEach((particle) => {
        context.save();
        context.globalAlpha = clamp(
          particle.life / particle.maxLife,
          0,
          1
        );
        context.fillStyle = particle.color;
        context.translate(particle.x, particle.y);
        context.rotate(Math.atan2(particle.vy, particle.vx));
        context.fillRect(
          -particle.size * 2.2,
          -particle.size * 0.45,
          particle.size * 4.4,
          particle.size * 0.9
        );
        context.restore();
      });
      drawPointerField(context);

      if (state.assistedTarget && state.world) {
        const player = getPlayerCenter(state.world);
        context.save();
        context.globalAlpha = clamp(
          state.assistedTarget.life / 0.28,
          0,
          1
        ) * 0.72;
        context.strokeStyle = "#69ddff";
        context.lineWidth = 1;
        context.setLineDash([3, 7]);
        context.beginPath();
        context.moveTo(player.x, player.y);
        context.lineTo(
          state.assistedTarget.x,
          state.assistedTarget.y
        );
        context.stroke();
        context.translate(
          state.assistedTarget.x,
          state.assistedTarget.y
        );
        context.rotate(Math.PI / 4);
        context.strokeRect(-6, -6, 12, 12);
        context.restore();
      }

      if (
        state.player.deathTimer > 0 &&
        state.world
      ) {
        const progress = 1 - state.player.deathTimer / 2.75;
        const player = getPlayerCenter(state.world);
        const gradient = context.createRadialGradient(
          player.x,
          player.y,
          0,
          player.x,
          player.y,
          Math.max(state.world.width, state.world.height) * 0.72
        );
        gradient.addColorStop(0, "rgb(255 31 45 / 7%)");
        gradient.addColorStop(0.35, "rgb(10 3 8 / 72%)");
        gradient.addColorStop(1, "rgb(0 0 0 / 96%)");
        context.save();
        context.fillStyle = gradient;
        context.fillRect(0, 0, state.world.width, state.world.height);
        context.strokeStyle = `rgb(255 31 45 / ${0.8 - progress * 0.25})`;
        context.shadowColor = "#ff1f2d";
        context.shadowBlur = 26;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(player.x, 0);
        context.lineTo(player.x, state.world.height);
        context.stroke();
        context.restore();
      }

      if (state.victoryTime > 0 && state.world) {
        context.save();
        const eye = getEye(state.world);
        const rayAge = state.victoryTime;
        if (state.victoryTime < VICTORY_SPLINTER_AT) {
          state.victoryRays.forEach((ray) => {
          const progress = clamp((rayAge - ray.delay) / 2.35, 0, 1);
          if (!progress) {
            return;
          }
          const length = Math.max(state.world.width, state.world.height) * ray.reach * easeOutCubic(progress);
          const origin = {
            x: ray.originX,
            y: ray.originY
          };
          const direction = { x: Math.cos(ray.beamAngle), y: Math.sin(ray.beamAngle) };
          const normal = { x: -direction.y, y: direction.x };
          const halfWidth = ray.width * (0.32 + progress * 1.35);
          const end = { x: origin.x + direction.x * length, y: origin.y + direction.y * length };
          context.save();
          context.globalCompositeOperation = "screen";
          context.globalAlpha = 0.72 + progress * 0.26;
          const rayGradient = context.createLinearGradient(
            origin.x,
            origin.y,
            end.x,
            end.y
          );
          rayGradient.addColorStop(0, "rgb(255 255 255 / 100%)");
          rayGradient.addColorStop(0.2, "rgb(255 255 255 / 76%)");
          rayGradient.addColorStop(0.72, "rgb(255 255 255 / 18%)");
          rayGradient.addColorStop(1, "rgb(255 255 255 / 0%)");
          context.fillStyle = rayGradient;
          context.shadowColor = "#ffffff";
          context.shadowBlur = 38 + progress * 34;
          context.beginPath();
          context.moveTo(origin.x + normal.x * 1.5, origin.y + normal.y * 1.5);
          context.lineTo(end.x + normal.x * halfWidth, end.y + normal.y * halfWidth);
          context.lineTo(end.x - normal.x * halfWidth, end.y - normal.y * halfWidth);
          context.closePath();
          context.fill();
            context.restore();
          });
        }
        const splinterFlash = clamp(
          1 - Math.max(0, state.victoryTime - VICTORY_SPLINTER_AT) / 0.82,
          0,
          state.victoryTime >= VICTORY_SPLINTER_AT ? 1 : 0
        );
        if (splinterFlash > 0) {
          context.globalAlpha = splinterFlash;
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, state.world.width, state.world.height);
        }
        context.restore();
      }

      if (
        state.victoryTime <= 0 &&
        state.player.hitFlash > 0 &&
        state.world
      ) {
        const player = getPlayerCenter(state.world);
        context.save();
        context.strokeStyle = `rgb(255 31 45 / ${state.player.hitFlash})`;
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(
          player.x,
          player.y,
          24 + (1 - state.player.hitFlash) * 12,
          0,
          TAU
        );
        context.stroke();
        context.restore();
      }
    }

    function getSnapshot() {
      return {
        active: state.active,
        phase: state.phase,
        phaseHealth: state.phaseHealth,
        playerHealth: state.player.health,
        thread: state.player.thread,
        objective: state.objective,
        minions: state.minions.filter((minion) => !minion.dead).length,
        minionRoles: state.minions
          .filter((minion) => !minion.dead)
          .map((minion) => minion.role),
        anchors: state.anchorIndex,
        anchorHealth: state.anchors[0]?.health ?? null,
        anchorPosition: state.anchors[0]
          ? {
              x: state.anchors[0].x,
              y: state.anchors[0].y - 28
            }
          : null,
        projectiles: state.projectiles.length,
        projectileData: state.projectiles.slice(0, 16).map(
          (projectile) => ({
            x: projectile.x,
            y: projectile.y,
            kind: projectile.kind,
            friendly: projectile.friendly
          })
        ),
        playerShotData: state.playerShots.slice(0, 8).map((shot) => ({
          x: shot.x,
          y: shot.y,
          targetId: shot.targetId,
          targetKind: shot.targetKind,
          life: shot.life
        })),
        debris: state.debris.length,
        transition: state.transitionTime,
        seals: state.seals.length,
        sealData: state.seals.map((seal) => ({
          x: seal.x,
          y: seal.y,
          health: seal.health
        })),
        zones: state.zones.length,
        deathTimer: state.player.deathTimer,
        victoryTime: state.victoryTime,
        platforms: state.platforms.length
      };
    }

    function getPlatforms() {
      return state.active
        ? state.platforms.map((platform) => ({ ...platform }))
        : [];
    }

    return {
      start,
      stop,
      update,
      drawBack,
      drawFront,
      meleeAttack,
      rangedAttack,
      pointerMove,
      pointerDown,
      playerFell,
      getPlatforms,
      getSnapshot,
      get active() {
        return state.active;
      },
      get phase() {
        return state.phase;
      }
    };
  };
})();
