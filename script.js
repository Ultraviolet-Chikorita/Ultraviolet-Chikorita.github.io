(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  const cursor = document.getElementById("customCursor");
  const cursorToggle = document.getElementById("cursorToggle");
  const cursorToggleState = document.getElementById("cursorToggleState");
  const copyEmailButton = document.getElementById("copyEmail");
  const emailCopyStatus = document.getElementById("emailCopyStatus");
  const content = document.querySelector(".content");
  const eyePanel = document.querySelector(".eye-panel");
  const eyeCanvas = document.getElementById("techEye");
  const eyeContext = eyeCanvas.getContext("2d");

  const selectionPolygon = document.getElementById("selectionPolygon");
  const selectionLines = document.getElementById("selectionLines");
  const eyePupil = document.getElementById("eyePupil");

  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const easterEggStage = document.getElementById("easterEggStage");
  const easterEggCanvas = document.getElementById("easterEggCanvas");
  const easterEggContext = easterEggCanvas.getContext("2d");
  const easterEggDashStatus = document.getElementById("easterEggDashStatus");
  const dashStatusLabel = document.getElementById("dashStatusLabel");
  const bossHealthFill = document.getElementById("bossHealthFill");
  const bossPhaseLabel = document.getElementById("bossPhaseLabel");
  const bossObjective = document.getElementById("bossObjective");
  const playerHealthPips = document.getElementById("playerHealthPips");
  const threadChargePips = document.getElementById("threadChargePips");
  const bossTimer = document.getElementById("bossTimer");
  const bossHeartsLost = document.getElementById("bossHeartsLost");
  const encounterResult = document.getElementById("encounterResult");
  const resultTime = document.getElementById("resultTime");
  const resultHeartsLost = document.getElementById("resultHeartsLost");
  const encounterShare = document.getElementById("encounterShare");
  const encounterShareStatus = document.getElementById("encounterShareStatus");
  const blurLayer = document.createElement("div");
  blurLayer.className = "selection-blur-layer";
  document.body.appendChild(blurLayer);
  const reducedMotionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  const forcedColorsPreference = window.matchMedia("(forced-colors: active)");

  const pointer = {
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2,
    insideViewport: false
  };
  const cursorImageSampleCache = new WeakMap();
  const cursorSampleOffsets = [-9, -4.5, 0, 4.5, 9];
  const cursorContrastSample = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    time: 0
  };
  const soundState = {
    context: null,
    master: null,
    cinematicReverbInput: null,
    noiseBuffer: null,
    sequenceSources: new Set(),
    effectSources: new Set(),
    assets: new Map(),
    assetFadeFrames: new Map(),
    dashAvailable: true
  };

  const selectionState = {
    active: false,
    contours: [],
    center: null
  };

  let lastFocusedElement = null;
  let eyeX = 0;
  let eyeY = 0;
  let eyeTargetX = 0;
  let eyeTargetY = 0;
  let selectionUpdateQueued = false;
  let customCursorEnabled = false;
  let irritationLevel = 0;
  const victoryIrisTwitch = {
    active: false,
    nextJoltAt: 0,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    targetX: 0,
    targetY: 0,
    targetRotation: 0,
    targetScaleX: 1,
    targetScaleY: 1
  };

  const easterEggState = {
    active: false,
    live: false,
    exiting: false,
    sceneVisible: false,
    savedScrollY: 0,
    sceneStartedAt: 0,
    lastFrameAt: 0,
    frameRequest: 0,
    groundY: 0,
    timers: [],
    keys: new Set(),
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      walkPhase: 0,
      idlePhase: 0,
      animationTime: 0,
      dashTime: 0,
      dashCooldown: 0,
      slideTime: 0,
      slideDirection: 0,
      airDashUsed: false,
      dashDirectionX: 0,
      dashDirectionY: 0,
      dashBufferTimer: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      landingSquash: 0,
      turnImpact: 0,
      takeoffStretch: 0,
      crouchImpact: 0,
      slideImpact: 0,
      crouchBlend: 0,
      crawlBlend: 0,
      respawnTimer: 0,
      trail: []
    }
  };
  let bossEncounter = null;

  const selectionAccentByIrritation = [
    "105 221 255",
    "255 240 72",
    "255 143 38",
    "255 31 45"
  ];
  const DASH_COOLDOWN_SECONDS = 0.5;
  const DASH_DURATION_SECONDS = 0.15;
  const SLIDE_DURATION_SECONDS = 0.5;
  const RUN_SPEED = 325;
  const CRAWL_SPEED = 104;
  const GROUND_ACCELERATION = 5000;
  const CRAWL_ACCELERATION = 2800;
  const AIR_ACCELERATION = 2050;
  const TURN_ACCELERATION = 8800;
  const GROUND_FRICTION = 6200;
  const AIR_DRAG = 95;
  const OVERSPEED_DRAG = 900;
  const JUMP_SPEED = 655;
  const DASH_BUFFER_SECONDS = 0.12;
  const COYOTE_TIME_SECONDS = 0.1;
  const JUMP_BUFFER_SECONDS = 0.12;
  const soundAssetConfig = {
    awakening: {
      source: "assets/audio/boss-awakening.wav?v=2",
      volume: 0.64
    },
    presence: {
      source: "assets/audio/boss-presence.wav?v=2",
      volume: 0.13,
      loop: true
    },
    battle: {
      source: "assets/audio/boss-battle-loop.wav?v=3",
      volume: 0.125,
      loop: true
    },
    regal: {
      source: "assets/audio/boss-battle-regal.wav?v=3",
      volume: 0.105,
      loop: true
    },
    percussion: {
      source: "assets/audio/boss-battle-percussion.wav?v=3",
      volume: 0.125,
      loop: true
    },
    menace: {
      source: "assets/audio/boss-battle-menace.wav?v=3",
      volume: 0.16,
      loop: true
    },
    strings: {
      source: "assets/audio/boss-battle-strings.wav?v=3",
      volume: 0.105,
      loop: true
    },
    choir: {
      source: "assets/audio/boss-battle-choir.wav?v=3",
      volume: 0.085,
      loop: true
    },
    brass: {
      source: "assets/audio/boss-battle-brass.wav?v=1",
      volume: 0.105,
      loop: true
    },
    mechanism: {
      source: "assets/audio/boss-battle-mechanism.wav?v=1",
      volume: 0.075,
      loop: true
    },
    pressure: {
      source: "assets/audio/boss-battle-pressure.wav?v=1",
      volume: 0.095,
      loop: true
    },
    irritationShatter: {
      source: "assets/audio/eye-irritation-shatter.wav?v=3",
      volume: 0.22
    },
    fallDeath: {
      source: "assets/audio/fall-death.wav?v=2",
      volume: 0.38
    },
    dashGround: {
      source: "assets/audio/dash-ground.wav?v=2",
      volume: 0.21
    },
    dashAir: {
      source: "assets/audio/dash-air.wav?v=2",
      volume: 0.19
    },
    slide: {
      source: "assets/audio/slide-stone.wav?v=2",
      volume: 0.31
    },
    jump: {
      source: "assets/audio/jump-dark.wav?v=2",
      volume: 0.28
    },
    landing: {
      source: "assets/audio/landing-heavy.wav?v=2",
      volume: 0.42
    },
    ready: {
      source: "assets/audio/dash-ready.wav?v=2",
      volume: 0.24
    }
  };
  const BOSS_MUSIC_LAYER_NAMES = [
    "battle",
    "regal",
    "percussion",
    "menace",
    "strings",
    "choir",
    "brass",
    "mechanism",
    "pressure"
  ];

  function prepareSoundAssets() {
    Object.entries(soundAssetConfig).forEach(([name, config]) => {
      const audio = new Audio(new URL(config.source, document.baseURI).href);
      audio.preload = config.loop ? "metadata" : "auto";
      audio.loop = Boolean(config.loop);
      audio.volume = config.volume;
      soundState.assets.set(name, { audio, config });
    });
  }

  function playSoundAsset(name, volumeScale = 1) {
    const asset = soundState.assets.get(name);
    if (!asset) {
      return;
    }

    const { audio, config } = asset;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(
        0,
        Math.min(1, config.volume * volumeScale)
      );
      audio.play().then(() => {
        easterEggStage.dataset.soundAsset = name;
      }).catch(() => {
        // Procedural Web Audio remains available if a file cannot be played.
      });
    } catch {
      // The procedural layer also serves as a local-file fallback.
    }
  }

  function playIrritationShatter(level) {
    const volumeScale = [0.34, 0.64, 1][
      Math.max(0, Math.min(2, level - 1))
    ];
    playSoundAsset("irritationShatter", volumeScale);
    easterEggStage.dataset.irritationSoundLevel = String(level);
  }

  function playFallDeathSound() {
    easterEggStage.dataset.soundCue = "fall-death";
    playSoundAsset("fallDeath");
  }

  function fadeSoundAsset(name, targetVolume, duration, pauseWhenSilent = false) {
    const asset = soundState.assets.get(name);
    if (!asset) {
      return;
    }

    cancelAnimationFrame(soundState.assetFadeFrames.get(name) || 0);
    const { audio } = asset;
    const initialVolume = audio.volume;
    const startedAt = performance.now();

    function updateFade(now) {
      const progress = Math.min(1, (now - startedAt) / (duration * 1000));
      const easedProgress = progress * progress * (3 - 2 * progress);
      audio.volume = initialVolume +
        (targetVolume - initialVolume) * easedProgress;

      if (progress < 1) {
        soundState.assetFadeFrames.set(
          name,
          requestAnimationFrame(updateFade)
        );
      } else {
        soundState.assetFadeFrames.delete(name);
        if (pauseWhenSilent && targetVolume <= 0.001) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    }

    soundState.assetFadeFrames.set(
      name,
      requestAnimationFrame(updateFade)
    );
  }

  function startBossPresence() {
    const asset = soundState.assets.get("presence");
    if (!asset) {
      return;
    }

    const { audio, config } = asset;
    cancelAnimationFrame(soundState.assetFadeFrames.get("presence") || 0);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.018;
    audio.play().then(() => {
      easterEggStage.dataset.soundBed = "presence";
      fadeSoundAsset("presence", config.volume, 3.35);
    }).catch(() => {});

    BOSS_MUSIC_LAYER_NAMES.forEach((name) => {
      const battleAsset = soundState.assets.get(name);
      if (!battleAsset) {
        return;
      }
      const battleAudio = battleAsset.audio;
      cancelAnimationFrame(soundState.assetFadeFrames.get(name) || 0);
      battleAudio.pause();
      battleAudio.currentTime = 0;
      battleAudio.volume = 0;
      battleAudio.play().catch(() => {});
    });
  }

  function setBossMusicPhase(phase) {
    const targetScales = {
      1: {
        battle: 0.82,
        menace: 0.44,
        percussion: 0.12,
        regal: 0,
        strings: 0.08,
        choir: 0,
        brass: 0.2,
        mechanism: 0.42,
        pressure: 0.2
      },
      2: {
        battle: 0.9,
        menace: 0.7,
        percussion: 0.56,
        regal: 0.44,
        strings: 0.62,
        choir: 0.22,
        brass: 0.66,
        mechanism: 0.76,
        pressure: 0.58
      },
      3: {
        battle: 0.96,
        menace: 1,
        percussion: 0.94,
        regal: 0.9,
        strings: 1,
        choir: 1,
        brass: 1,
        mechanism: 0.94,
        pressure: 1
      },
      4: {
        battle: 0.12,
        menace: 0.14,
        percussion: 0,
        regal: 0.08,
        strings: 0.85,
        choir: 1.15,
        brass: 0.16,
        mechanism: 0,
        pressure: 0
      }
    };
    const targets = targetScales[phase] || targetScales[1];
    Object.entries(targets).forEach(([name, scale], index) => {
      const asset = soundState.assets.get(name);
      if (!asset) {
        return;
      }
      fadeSoundAsset(
        name,
        asset.config.volume * scale,
        phase === 4
          ? (name === "percussion" ? 0.38 : 0.82 + index * 0.12)
          : 1.35 + index * 0.07,
        false
      );
    });
    easterEggStage.dataset.musicPhase = String(phase);
  }

  function finishBossEndingMusic() {
    BOSS_MUSIC_LAYER_NAMES.filter((name) => name !== "choir").forEach(
      (name, index) => {
        fadeSoundAsset(name, 0, 0.14 + index * 0.035, true);
      }
    );
    // Let the choir dissolve into the light instead of cutting with the hit.
    fadeSoundAsset("choir", 0, 2.8, true);
  }

  function startBossBattleMusic() {
    const battleLayers = BOSS_MUSIC_LAYER_NAMES
      .map((name) => [name, soundState.assets.get(name)])
      .filter(([, asset]) => Boolean(asset));
    if (!battleLayers.length) {
      return;
    }

    easterEggStage.dataset.soundLayers = battleLayers
      .map(([name]) => name)
      .join(",");
    fadeSoundAsset("presence", 0, 1.05, true);
    battleLayers.forEach(([name, { audio }]) => {
      cancelAnimationFrame(soundState.assetFadeFrames.get(name) || 0);
      audio.currentTime = 0;
      audio.volume = 0;
      audio.play().then(() => {
        easterEggStage.dataset.soundBed = "battle-layered";
      }).catch(() => {});
    });
    setBossMusicPhase(1);
  }

  function stopSoundAssets() {
    soundState.assetFadeFrames.forEach((frame) => {
      cancelAnimationFrame(frame);
    });
    soundState.assetFadeFrames.clear();
    soundState.assets.forEach(({ audio }, name) => {
      if (
        (
          name === "presence" ||
          name === "battle" ||
          name === "regal" ||
          name === "percussion" ||
          name === "menace" ||
          name === "strings" ||
          name === "choir" ||
          name === "brass" ||
          name === "mechanism" ||
          name === "pressure"
        ) &&
        !audio.paused
      ) {
        fadeSoundAsset(name, 0, 0.62, true);
        return;
      }
      audio.pause();
      audio.currentTime = 0;
    });
  }

  function ensureSoundContext() {
    if (soundState.context) {
      if (soundState.context.state === "suspended") {
        soundState.context.resume().catch(() => {});
      }
      return soundState.context;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    try {
      const context = new AudioContextClass();
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();

      master.gain.value = 0.48;
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(context.destination);

      const cinematicReverbInput = context.createGain();
      const convolver = context.createConvolver();
      const reverbOutput = context.createGain();
      const impulseLength = Math.round(context.sampleRate * 3.6);
      const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const samples = impulse.getChannelData(channel);
        for (let index = 0; index < impulseLength; index += 1) {
          const progress = index / impulseLength;
          const earlyReflection = index < context.sampleRate * 0.085
            ? Math.sin(index * (channel ? 0.091 : 0.077)) * 0.18
            : 0;
          samples[index] = (
            (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.7) +
            earlyReflection * (1 - progress)
          );
        }
      }
      convolver.buffer = impulse;
      reverbOutput.gain.value = 0.34;
      cinematicReverbInput.connect(convolver);
      convolver.connect(reverbOutput);
      reverbOutput.connect(master);

      soundState.context = context;
      soundState.master = master;
      soundState.cinematicReverbInput = cinematicReverbInput;
      context.resume().catch(() => {});
      return context;
    } catch {
      return null;
    }
  }

  function getSoundSourceSet(group) {
    return group === "sequence"
      ? soundState.sequenceSources
      : soundState.effectSources;
  }

  function trackSoundSource(source, group) {
    const sourceSet = getSoundSourceSet(group);
    sourceSet.add(source);
    source.addEventListener("ended", () => {
      sourceSet.delete(source);
    }, { once: true });
  }

  function connectSoundOutput(context, node, pan = 0, reverb = 0) {
    let output = node;
    if (typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      output = panner;
    }
    output.connect(soundState.master);
    if (reverb > 0 && soundState.cinematicReverbInput) {
      const reverbSend = context.createGain();
      reverbSend.gain.value = Math.max(0, Math.min(1, reverb));
      output.connect(reverbSend);
      reverbSend.connect(soundState.cinematicReverbInput);
    }
  }

  function scheduleTone({
    time,
    frequency,
    endFrequency = frequency,
    duration,
    gain = 0.05,
    attack = 0.008,
    type = "sine",
    pan = 0,
    reverb = 0,
    group = "effect"
  }) {
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const startTime = Math.max(context.currentTime, time);
    const endTime = startTime + duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      endTime
    );
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.linearRampToValueAtTime(
      Math.max(0.0001, gain),
      startTime + Math.min(attack, duration * 0.4)
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(envelope);
    connectSoundOutput(context, envelope, pan, reverb);
    trackSoundSource(oscillator, group);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.025);
  }

  function getNoiseBuffer(context) {
    if (
      soundState.noiseBuffer &&
      soundState.noiseBuffer.sampleRate === context.sampleRate
    ) {
      return soundState.noiseBuffer;
    }

    const frameCount = Math.round(context.sampleRate);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.34 + white * 0.66;
      samples[index] = previous;
    }

    soundState.noiseBuffer = buffer;
    return buffer;
  }

  function scheduleNoise({
    time,
    duration,
    gain = 0.04,
    attack = 0.006,
    filterType = "bandpass",
    frequency = 1200,
    endFrequency = frequency,
    resonance = 0.8,
    pan = 0,
    reverb = 0,
    swell = false,
    group = "effect"
  }) {
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const startTime = Math.max(context.currentTime, time);
    const endTime = startTime + duration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();

    source.buffer = getNoiseBuffer(context);
    source.loop = true;
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, frequency), startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      endTime
    );
    filter.Q.value = resonance;
    envelope.gain.setValueAtTime(0.0001, startTime);
    if (swell) {
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gain * 0.1),
        startTime + duration * 0.24
      );
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gain),
        endTime - Math.min(0.035, duration * 0.08)
      );
    } else {
      envelope.gain.linearRampToValueAtTime(
        Math.max(0.0001, gain),
        startTime + Math.min(attack, duration * 0.35)
      );
    }
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(envelope);
    connectSoundOutput(context, envelope, pan, reverb);
    trackSoundSource(source, group);
    source.start(startTime, Math.random() * 0.55);
    source.stop(endTime + 0.025);
  }

  function scheduleDecoChime({
    time,
    frequency,
    gain = 0.04,
    duration = 0.48,
    pan = 0,
    reverb = 0.55,
    group = "effect"
  }) {
    [
      [1, 1, 0],
      [1.49, 0.42, 0.006],
      [2.03, 0.24, 0.012],
      [2.71, 0.1, 0.018]
    ].forEach(([multiple, level, delay], index) => {
      scheduleTone({
        time: time + delay,
        frequency: frequency * multiple,
        endFrequency: frequency * multiple * (0.996 - index * 0.001),
        duration: duration * (1 - index * 0.08),
        gain: gain * level,
        attack: 0.004 + index * 0.002,
        type: index < 2 ? "sine" : "triangle",
        pan: pan + (index % 2 ? 0.06 : -0.06),
        reverb,
        group
      });
    });
  }

  function scheduleCinematicImpact({
    time,
    strength = 1,
    pitch = 62,
    pan = 0,
    bright = 0.5,
    duration = 0.7,
    reverb = 0.38,
    group = "effect"
  }) {
    scheduleTone({
      time,
      frequency: pitch,
      endFrequency: Math.max(18, pitch * 0.42),
      duration,
      gain: 0.105 * strength,
      attack: 0.002,
      type: "sine",
      pan: pan * 0.42,
      reverb: reverb * 0.5,
      group
    });
    scheduleTone({
      time: time + 0.008,
      frequency: pitch * 2.48,
      endFrequency: pitch * 0.82,
      duration: duration * 0.62,
      gain: 0.058 * strength,
      attack: 0.002,
      type: "triangle",
      pan,
      reverb,
      group
    });
    scheduleNoise({
      time,
      duration: duration * 0.46,
      gain: (0.07 + bright * 0.055) * strength,
      attack: 0.001,
      filterType: "bandpass",
      frequency: 760 + bright * 2200,
      endFrequency: 120,
      resonance: 0.82,
      pan,
      reverb,
      group
    });
    scheduleNoise({
      time,
      duration: 0.055 + bright * 0.055,
      gain: 0.045 * strength * bright,
      attack: 0.001,
      filterType: "highpass",
      frequency: 5200,
      endFrequency: 1500,
      resonance: 0.35,
      pan,
      reverb: reverb * 1.25,
      group
    });
  }

  function stopSoundSources(sourceSet) {
    sourceSet.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source may already have ended between frames.
      }
    });
    sourceSet.clear();
  }

  function playEasterEggActivationSound() {
    playSoundAsset("awakening");
    startBossPresence();
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    stopSoundSources(soundState.sequenceSources);
    const start = context.currentTime + 0.025;
    easterEggStage.dataset.soundCue = "activation";

    // Fourth click: a dry ocular snap with a short, low pressure release.
    scheduleTone({
      time: start,
      frequency: 104,
      endFrequency: 46,
      duration: 0.48,
      gain: 0.105,
      attack: 0.004,
      type: "sine",
      group: "sequence"
    });
    scheduleTone({
      time: start,
      frequency: 760,
      endFrequency: 310,
      duration: 0.17,
      gain: 0.055,
      attack: 0.002,
      type: "triangle",
      group: "sequence"
    });
    scheduleNoise({
      time: start,
      duration: 0.12,
      gain: 0.055,
      filterType: "highpass",
      frequency: 2100,
      endFrequency: 720,
      resonance: 0.5,
      group: "sequence"
    });

    // The page falls away and the eye settles into the new scene.
    scheduleNoise({
      time: start + 0.42,
      duration: 0.68,
      gain: 0.045,
      attack: 0.08,
      filterType: "bandpass",
      frequency: 1180,
      endFrequency: 240,
      resonance: 1.8,
      group: "sequence"
    });
    scheduleTone({
      time: start + 0.46,
      frequency: 73,
      endFrequency: 49,
      duration: 0.72,
      gain: 0.052,
      attack: 0.035,
      type: "sine",
      group: "sequence"
    });

    // Four alternating etches follow the ground line as it draws outward.
    [0, 1, 2, 3].forEach((index) => {
      const cueTime = start + 1.18 + index * 0.34;
      const pan = index % 2 === 0 ? -0.42 : 0.42;
      scheduleNoise({
        time: cueTime,
        duration: 0.105,
        gain: 0.038,
        filterType: "bandpass",
        frequency: 1360 + index * 170,
        endFrequency: 530 + index * 70,
        resonance: 2.6,
        pan,
        group: "sequence"
      });
      scheduleTone({
        time: cueTime,
        frequency: 286 + index * 42,
        endFrequency: 236 + index * 34,
        duration: 0.13,
        gain: 0.025,
        attack: 0.003,
        type: "triangle",
        pan,
        group: "sequence"
      });
    });

    // Polygon pieces arrive as a rising, deliberately imperfect assembly.
    [196, 247, 294, 370].forEach((frequency, index) => {
      const cueTime = start + 2.63 + index * 0.17;
      scheduleTone({
        time: cueTime,
        frequency: frequency * 1.08,
        endFrequency: frequency,
        duration: 0.16,
        gain: 0.035,
        attack: 0.004,
        type: index % 2 ? "triangle" : "sine",
        pan: (index - 1.5) * 0.14,
        group: "sequence"
      });
      scheduleNoise({
        time: cueTime,
        duration: 0.045,
        gain: 0.018,
        filterType: "highpass",
        frequency: 2400 + index * 240,
        endFrequency: 1500,
        resonance: 0.4,
        pan: (index - 1.5) * 0.14,
        group: "sequence"
      });
    });

    // Controls unlock on a compact, non-triumphant resolved chord.
    scheduleTone({
      time: start + 3.36,
      frequency: 82,
      endFrequency: 55,
      duration: 0.42,
      gain: 0.072,
      attack: 0.006,
      type: "sine",
      group: "sequence"
    });
    [220, 330, 440].forEach((frequency, index) => {
      scheduleTone({
        time: start + 3.36 + index * 0.018,
        frequency,
        endFrequency: frequency * 0.985,
        duration: 0.52 - index * 0.05,
        gain: 0.025,
        attack: 0.014,
        type: "triangle",
        pan: (index - 1) * 0.18,
        group: "sequence"
      });
    });
  }

  function playDashSound(direction, airborne) {
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const start = context.currentTime;
    const pan = Math.max(-0.62, Math.min(0.62, direction.x * 0.62));
    easterEggStage.dataset.soundCue = airborne ? "air-dash" : "dash";
    playSoundAsset(airborne ? "dashAir" : "dashGround");
    scheduleNoise({
      time: start,
      duration: 0.22,
      gain: airborne ? 0.05 : 0.055,
      attack: 0.003,
      filterType: "bandpass",
      frequency: airborne ? 3100 : 2300,
      endFrequency: airborne ? 680 : 430,
      resonance: airborne ? 0.7 : 1.1,
      pan,
      reverb: airborne ? 0.42 : 0.24
    });
    scheduleTone({
      time: start,
      frequency: airborne ? 245 : 184,
      endFrequency: airborne ? 92 : 62,
      duration: 0.2,
      gain: airborne ? 0.035 : 0.042,
      attack: 0.002,
      type: "sine",
      pan,
      reverb: 0.2
    });
    if (airborne) {
      scheduleTone({
        time: start + 0.012,
        frequency: 920,
        endFrequency: 410,
        duration: 0.16,
        gain: 0.014,
        attack: 0.003,
        type: "triangle",
        pan,
        reverb: 0.46
      });
    }
    scheduleDecoChime({
      time: start + 0.018,
      frequency: airborne ? 392 : 293.66,
      gain: airborne ? 0.018 : 0.014,
      duration: airborne ? 0.42 : 0.31,
      pan,
      reverb: airborne ? 0.58 : 0.36
    });
  }

  function playSlideSound(direction) {
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const start = context.currentTime;
    const pan = direction * 0.52;
    easterEggStage.dataset.soundCue = "slide";
    playSoundAsset("slide");
    scheduleNoise({
      time: start,
      duration: SLIDE_DURATION_SECONDS,
      gain: 0.12,
      attack: 0.008,
      filterType: "bandpass",
      frequency: 1380,
      endFrequency: 230,
      resonance: 1.35,
      pan,
      reverb: 0.22
    });
    scheduleTone({
      time: start,
      frequency: 112,
      endFrequency: 48,
      duration: 0.32,
      gain: 0.072,
      attack: 0.004,
      type: "sawtooth",
      pan,
      reverb: 0.18
    });
    scheduleDecoChime({
      time: start + 0.08,
      frequency: 146.83,
      gain: 0.012,
      duration: 0.46,
      pan: -pan * 0.45,
      reverb: 0.32
    });
  }

  function playDashReadySound() {
    const context = ensureSoundContext();
    if (!context || !easterEggState.live) {
      return;
    }

    const start = context.currentTime;
    easterEggStage.dataset.soundCue = "dash-ready";
    playSoundAsset("ready");
    scheduleTone({
      time: start,
      frequency: 440,
      endFrequency: 554,
      duration: 0.095,
      gain: 0.026,
      attack: 0.003,
      type: "triangle",
      reverb: 0.5
    });
    scheduleTone({
      time: start + 0.055,
      frequency: 659,
      endFrequency: 650,
      duration: 0.11,
      gain: 0.018,
      attack: 0.003,
      type: "sine",
      reverb: 0.62
    });
    scheduleDecoChime({
      time: start + 0.018,
      frequency: 293.66,
      gain: 0.014,
      duration: 0.52,
      reverb: 0.68
    });
  }

  function playJumpSound() {
    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const slideAsset = soundState.assets.get("slide");
    if (slideAsset && !slideAsset.audio.paused) {
      slideAsset.audio.pause();
      slideAsset.audio.currentTime = 0;
    }
    easterEggStage.dataset.soundCue = "jump";
    playSoundAsset("jump");
    scheduleTone({
      time: context.currentTime,
      frequency: 92,
      endFrequency: 174,
      duration: 0.19,
      gain: 0.034,
      attack: 0.009,
      type: "sine",
      reverb: 0.28
    });
    scheduleDecoChime({
      time: context.currentTime + 0.025,
      frequency: 220,
      gain: 0.012,
      duration: 0.32,
      reverb: 0.42
    });
  }

  function playLandingSound(landingVelocity) {
    if (landingVelocity < 235 || !easterEggState.live) {
      return;
    }

    const context = ensureSoundContext();
    if (!context) {
      return;
    }

    const strength = Math.max(
      0.38,
      Math.min(1, (landingVelocity - 180) / 560)
    );
    easterEggStage.dataset.soundCue = "landing";
    playSoundAsset("landing", strength);
    scheduleCinematicImpact({
      time: context.currentTime,
      strength: 0.48 + strength * 0.32,
      pitch: 62,
      bright: 0.34,
      duration: 0.54,
      reverb: 0.24
    });
  }

  function triggerBossCrackShake(intensity) {
    const strength = Math.max(0.35, Math.min(1.45, intensity || 0.6));
    const horizontal = 8 + strength * 18;
    const vertical = 5 + strength * 10;
    const rotation = 0.2 + strength * 0.48;
    const keyframes = [
      { transform: "translate3d(0, 0, 0) rotate(0deg)" },
      { transform: `translate3d(${-horizontal}px, ${vertical * 0.45}px, 0) rotate(${-rotation}deg)` },
      { transform: `translate3d(${horizontal * 0.82}px, ${-vertical}px, 0) rotate(${rotation * 0.75}deg)` },
      { transform: `translate3d(${-horizontal * 0.58}px, ${vertical * 0.7}px, 0) rotate(${-rotation * 0.48}deg)` },
      { transform: `translate3d(${horizontal * 0.34}px, ${-vertical * 0.38}px, 0) rotate(${rotation * 0.24}deg)` },
      { transform: "translate3d(0, 0, 0) rotate(0deg)" }
    ];
    [easterEggStage, eyePanel].forEach((element) => {
      element.animate(keyframes, {
        duration: 300 + strength * 120,
        easing: "cubic-bezier(.18,.72,.24,1)"
      });
    });
  }

  function scheduleBossEndingScore(context, start) {
    stopSoundSources(soundState.sequenceSources);

    // A low D pedal keeps the ending tied to the battle score while the rhythm
    // falls away. The upper voices open gradually as more light escapes.
    [
      [36.75, 32.7, 0.105, -0.16],
      [55, 49, 0.074, 0.16],
      [73.5, 73.9, 0.052, -0.34],
      [87.31, 88.1, 0.038, 0.3],
      [110, 111.2, 0.034, 0.08]
    ].forEach(([frequency, endFrequency, gain, pan], index) => {
      scheduleTone({
        time: start + index * 0.055,
        frequency,
        endFrequency,
        duration: 4.72 - index * 0.07,
        gain,
        attack: 0.72 + index * 0.18,
        type: index < 2 ? "sine" : "triangle",
        pan,
        reverb: index < 2 ? 0.28 : 0.62,
        group: "sequence"
      });
    });

    scheduleNoise({
      time: start + 0.08,
      duration: 4.58,
      gain: 0.12,
      filterType: "bandpass",
      frequency: 310,
      endFrequency: 5400,
      resonance: 0.72,
      reverb: 0.72,
      swell: true,
      group: "sequence"
    });

    // A late harmonic lift pulls the ear toward the final white flash.
    [146.83, 220, 293.66, 440].forEach((frequency, index) => {
      scheduleTone({
        time: start + 3.18 + index * 0.08,
        frequency: frequency * 0.84,
        endFrequency: frequency,
        duration: 1.35 - index * 0.06,
        gain: 0.028 - index * 0.003,
        attack: 0.68,
        type: index < 2 ? "sine" : "triangle",
        pan: (index - 1.5) * 0.28,
        reverb: 0.78,
        group: "sequence"
      });
    });
  }

  function playCombatSoundCue(name, intensity = 1) {
    if (name === "splinter") {
      document.body.classList.add("boss-splintered");
      triggerBossCrackShake(1.45);
      finishBossEndingMusic();
      stopSoundSources(soundState.sequenceSources);
    }
    if (name === "crack-light") {
      triggerBossCrackShake(intensity);
    }
    const context = ensureSoundContext();
    if (!context) {
      return;
    }
    const start = context.currentTime;
    const strength = Math.max(0.22, Math.min(1, intensity || 0.5));
    easterEggStage.dataset.soundCue = name;

    if (name === "melee") {
      const attackPan = (easterEggState.player.facing || 1) * 0.24;
      scheduleNoise({
        time: start,
        duration: 0.14,
        gain: 0.042 + strength * 0.025,
        attack: 0.002,
        filterType: "highpass",
        frequency: 6800,
        endFrequency: 980,
        resonance: 0.48,
        pan: attackPan,
        reverb: 0.18
      });
      scheduleTone({
        time: start,
        frequency: 248 + strength * 86,
        endFrequency: 68,
        duration: 0.18,
        gain: 0.038 + strength * 0.025,
        attack: 0.002,
        type: "triangle",
        pan: attackPan * 0.55,
        reverb: 0.16
      });
      scheduleNoise({
        time: start + 0.018,
        duration: 0.23,
        gain: 0.035 * strength,
        filterType: "bandpass",
        frequency: 980,
        endFrequency: 180,
        resonance: 1.2,
        pan: attackPan,
        reverb: 0.28
      });
      scheduleDecoChime({
        time: start + 0.012,
        frequency: 587.33 + strength * 146.83,
        gain: 0.018 + strength * 0.011,
        duration: 0.28,
        pan: attackPan,
        reverb: 0.34
      });
      return;
    }

    if (name === "thread-shot") {
      scheduleTone({
        time: start,
        frequency: 392,
        endFrequency: 880 + strength * 220,
        duration: 0.24,
        gain: 0.035 + strength * 0.018,
        attack: 0.012,
        type: "triangle",
        reverb: 0.48
      });
      scheduleNoise({
        time: start,
        duration: 0.18,
        gain: 0.028 + strength * 0.016,
        attack: 0.002,
        filterType: "bandpass",
        frequency: 6200,
        endFrequency: 1200,
        resonance: 1.4,
        reverb: 0.42
      });
      scheduleTone({
        time: start,
        frequency: 110,
        endFrequency: 73.5,
        duration: 0.3,
        gain: 0.036 * strength,
        attack: 0.004,
        type: "sine",
        reverb: 0.2
      });
      scheduleDecoChime({
        time: start + 0.035,
        frequency: strength > 0.72 ? 329.63 : 293.66,
        gain: 0.026 + strength * 0.012,
        duration: 0.56,
        pan: 0.08,
        reverb: 0.7
      });
      return;
    }

    if (name === "enemy-hit" || name === "boss-hit") {
      const bossImpact = name === "boss-hit";
      scheduleCinematicImpact({
        time: start,
        strength: strength * (bossImpact ? 0.92 : 0.58),
        pitch: bossImpact ? 58 : 104,
        bright: bossImpact ? 0.48 : 0.78,
        duration: bossImpact ? 0.72 : 0.34,
        reverb: bossImpact ? 0.48 : 0.28
      });
      scheduleDecoChime({
        time: start + 0.018,
        frequency: bossImpact ? 146.83 : 293.66,
        gain: (bossImpact ? 0.038 : 0.022) * strength,
        duration: bossImpact ? 0.62 : 0.3,
        pan: bossImpact ? 0 : 0.14,
        reverb: bossImpact ? 0.58 : 0.34
      });
      return;
    }

    if (name === "assemble") {
      [0, 0.055, 0.12].forEach((delay, index) => {
        scheduleNoise({
          time: start + delay,
          duration: 0.07,
          gain: (0.038 + index * 0.008) * strength,
          attack: 0.001,
          filterType: "bandpass",
          frequency: 2200 - index * 320,
          endFrequency: 480,
          resonance: 2.4,
          pan: (index - 1) * 0.32,
          reverb: 0.3
        });
        scheduleDecoChime({
          time: start + delay,
          frequency: [220, 293.66, 440][index],
          gain: (0.025 + index * 0.004) * strength,
          duration: 0.42 + index * 0.08,
          pan: (index - 1) * 0.32,
          reverb: 0.56
        });
      });
      scheduleTone({
        time: start,
        frequency: 73.5,
        endFrequency: 49,
        duration: 0.52,
        gain: 0.045 * strength,
        attack: 0.012,
        type: "sine",
        reverb: 0.22
      });
      return;
    }

    if (name === "thread-ready") {
      [293.66, 440, 587.33].forEach((frequency, index) => {
        scheduleDecoChime({
          time: start + index * 0.065,
          frequency,
          gain: (0.026 - index * 0.003) * strength,
          duration: 0.62 + index * 0.1,
          pan: (index - 1) * 0.28,
          reverb: 0.76
        });
      });
      scheduleNoise({
        time: start,
        duration: 0.42,
        gain: 0.026 * strength,
        filterType: "highpass",
        frequency: 1400,
        endFrequency: 7400,
        resonance: 0.45,
        reverb: 0.72,
        swell: true
      });
      return;
    }

    if (name === "ward-open") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.86 * strength,
        pitch: 44,
        bright: 0.52,
        duration: 1.15,
        reverb: 0.58
      });
      [73.5, 110, 146.83, 220].forEach((frequency, index) => {
        scheduleTone({
          time: start + 0.03 + index * 0.035,
          frequency: frequency * 0.88,
          endFrequency: frequency,
          duration: 1.25 - index * 0.08,
          gain: (0.052 - index * 0.006) * strength,
          attack: 0.16,
          type: index < 2 ? "sine" : "triangle",
          pan: (index - 1.5) * 0.22,
          reverb: 0.78
        });
      });
      return;
    }

    if (name === "telegraph") {
      scheduleTone({
        time: start,
        frequency: 73.5,
        endFrequency: 55,
        duration: 0.62,
        gain: 0.052 * strength,
        attack: 0.018,
        type: "sine",
        reverb: 0.32
      });
      scheduleTone({
        time: start,
        frequency: 164.81,
        endFrequency: 523.25 + strength * 180,
        duration: 0.68,
        gain: 0.035 * strength,
        attack: 0.32,
        type: "sawtooth",
        reverb: 0.58
      });
      scheduleNoise({
        time: start,
        duration: 0.68,
        gain: 0.055 * strength,
        filterType: "bandpass",
        frequency: 380,
        endFrequency: 6200,
        resonance: 1.15,
        reverb: 0.64,
        swell: true
      });
      scheduleDecoChime({
        time: start + 0.48,
        frequency: strength > 0.88 ? 146.83 : 130.81,
        gain: 0.028 * strength,
        duration: 0.56,
        reverb: 0.72
      });
      return;
    }

    if (name === "crown-assemble") {
      scheduleNoise({
        time: start + 0.08,
        duration: 0.88,
        gain: 0.075,
        filterType: "bandpass",
        frequency: 360,
        endFrequency: 6800,
        resonance: 0.82,
        reverb: 0.74,
        swell: true
      });
      [
        [0.16, -0.62, 110],
        [0.36, 0, 146.83],
        [0.56, 0.62, 220]
      ].forEach(([delay, pan, frequency], index) => {
        scheduleNoise({
          time: start + delay,
          duration: 0.11,
          gain: 0.075 + index * 0.012,
          attack: 0.001,
          filterType: "bandpass",
          frequency: 2400 + index * 620,
          endFrequency: 380,
          resonance: 2.2,
          pan,
          reverb: 0.48
        });
        scheduleDecoChime({
          time: start + delay,
          frequency,
          gain: 0.036 + index * 0.006,
          duration: 0.86 + index * 0.13,
          pan,
          reverb: 0.82
        });
        scheduleTone({
          time: start + delay,
          frequency: 62 - index * 6,
          endFrequency: 31 - index * 3,
          duration: 0.72,
          gain: 0.055 + index * 0.008,
          attack: 0.003,
          type: "sine",
          pan: pan * 0.34,
          reverb: 0.3
        });
      });
      [55, 73.5, 77.78, 110].forEach((frequency, index) => {
        scheduleTone({
          time: start + 0.16 + index * 0.025,
          frequency: frequency * 0.94,
          endFrequency: frequency,
          duration: 1.85 - index * 0.12,
          gain: 0.045 - index * 0.005,
          attack: 0.44,
          type: index < 2 ? "sine" : "triangle",
          pan: (index - 1.5) * 0.26,
          reverb: 0.82
        });
      });
      scheduleCinematicImpact({
        time: start + 0.62,
        strength: 0.78,
        pitch: 42,
        bright: 0.56,
        duration: 1.1,
        reverb: 0.62
      });
      return;
    }

    if (name === "crown-emitter") {
      const emitterIndex = Math.max(0, Math.min(2, Math.round(intensity) - 1));
      const emitterPan = [-0.68, 0, 0.68][emitterIndex];
      const emitterPitch = [220, 293.66, 392][emitterIndex];
      [0, 0.026, 0.061].forEach((delay, index) => {
        scheduleNoise({
          time: start + delay,
          duration: 0.052 + index * 0.018,
          gain: 0.042 + index * 0.009,
          attack: 0.001,
          filterType: "bandpass",
          frequency: 3600 - index * 520,
          endFrequency: 620 + index * 120,
          resonance: 2.8,
          pan: emitterPan,
          reverb: 0.42
        });
      });
      scheduleDecoChime({
        time: start + 0.018,
        frequency: emitterPitch,
        gain: 0.028,
        duration: 0.52,
        pan: emitterPan,
        reverb: 0.64
      });
      scheduleTone({
        time: start,
        frequency: 82.41 + emitterIndex * 12,
        endFrequency: 55 + emitterIndex * 8,
        duration: 0.34,
        gain: 0.035,
        attack: 0.004,
        type: "triangle",
        pan: emitterPan,
        reverb: 0.28
      });
      return;
    }

    if (name === "crown-splitter") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.72 * strength,
        pitch: 58,
        bright: 0.78,
        duration: 0.66,
        reverb: 0.48
      });
      [196, 261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
        const pan = (index - 2) * 0.26;
        scheduleTone({
          time: start + index * 0.022,
          frequency: frequency * 0.76,
          endFrequency: frequency * 1.08,
          duration: 0.46 - index * 0.035,
          gain: (0.036 - index * 0.004) * strength,
          attack: 0.055,
          type: index % 2 ? "triangle" : "sawtooth",
          pan,
          reverb: 0.62
        });
      });
      scheduleNoise({
        time: start + 0.018,
        duration: 0.38,
        gain: 0.064 * strength,
        filterType: "highpass",
        frequency: 1800,
        endFrequency: 8800,
        resonance: 0.48,
        reverb: 0.58,
        swell: true
      });
      return;
    }

    if (name === "crown-rupture") {
      scheduleTone({
        time: start,
        frequency: 73.5,
        endFrequency: 36.75,
        duration: 0.92,
        gain: 0.075 * strength,
        attack: 0.025,
        type: "sine",
        reverb: 0.46
      });
      [220, 207.65, 155.56].forEach((frequency, index) => {
        scheduleTone({
          time: start + index * 0.07,
          frequency,
          endFrequency: frequency * 0.56,
          duration: 0.72 + index * 0.08,
          gain: (0.042 - index * 0.005) * strength,
          attack: 0.12,
          type: index === 1 ? "sawtooth" : "triangle",
          pan: (index - 1) * 0.34,
          reverb: 0.68
        });
      });
      scheduleNoise({
        time: start,
        duration: 0.82,
        gain: 0.072 * strength,
        filterType: "bandpass",
        frequency: 320,
        endFrequency: 5400,
        resonance: 1.3,
        reverb: 0.72,
        swell: true
      });
      scheduleDecoChime({
        time: start + 0.58,
        frequency: 123.47,
        gain: 0.04 * strength,
        duration: 0.92,
        reverb: 0.82
      });
      return;
    }

    if (name === "crown-floor-surge") {
      scheduleTone({
        time: start,
        frequency: 44,
        endFrequency: 27.5,
        duration: 1.18,
        gain: 0.09,
        attack: 0.03,
        type: "sine",
        reverb: 0.34
      });
      scheduleNoise({
        time: start,
        duration: 0.9,
        gain: 0.09,
        filterType: "bandpass",
        frequency: 260,
        endFrequency: 5200,
        resonance: 0.76,
        reverb: 0.68,
        swell: true
      });
      [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72].forEach(
        (pan, index) => {
          const strikeTime = start + 0.12 + index * 0.1;
          scheduleNoise({
            time: strikeTime,
            duration: 0.11,
            gain: 0.052 + index * 0.004,
            attack: 0.001,
            filterType: "bandpass",
            frequency: 1800 + index * 310,
            endFrequency: 260,
            resonance: 2.1,
            pan,
            reverb: 0.46
          });
          scheduleDecoChime({
            time: strikeTime,
            frequency: [110, 123.47, 146.83, 174.61, 220, 261.63, 329.63][index],
            gain: 0.022 + index * 0.002,
            duration: 0.42 + index * 0.035,
            pan,
            reverb: 0.64
          });
        }
      );
      scheduleCinematicImpact({
        time: start + 0.84,
        strength: 0.82,
        pitch: 38.89,
        bright: 0.62,
        duration: 0.92,
        reverb: 0.58
      });
      return;
    }

    if (name === "crown-volley") {
      const bladeCount = strength > 0.82 ? 7 : 5;
      for (let index = 0; index < bladeCount; index += 1) {
        const delay = index * 0.025;
        const pan = bladeCount === 1
          ? 0
          : -0.46 + index / (bladeCount - 1) * 0.92;
        scheduleNoise({
          time: start + delay,
          duration: 0.075,
          gain: 0.038 + strength * 0.012,
          attack: 0.001,
          filterType: "highpass",
          frequency: 5400 + index * 260,
          endFrequency: 1300,
          resonance: 0.52,
          pan,
          reverb: 0.36
        });
        scheduleTone({
          time: start + delay,
          frequency: 293.66 + index * 36,
          endFrequency: 110 + index * 12,
          duration: 0.24,
          gain: 0.026 + strength * 0.01,
          attack: 0.002,
          type: "triangle",
          pan,
          reverb: 0.42
        });
      }
      scheduleTone({
        time: start,
        frequency: 82.41,
        endFrequency: 49,
        duration: 0.52,
        gain: 0.052 * strength,
        attack: 0.004,
        type: "sine",
        reverb: 0.3
      });
      return;
    }

    if (name === "crown-resonance") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.86,
        pitch: 49,
        bright: 0.9,
        duration: 0.82,
        reverb: 0.62
      });
      [110, 164.81, 220, 329.63, 440].forEach((frequency, index) => {
        scheduleTone({
          time: start + index * 0.018,
          frequency: frequency * 0.92,
          endFrequency: frequency * 1.035,
          duration: 1.15 - index * 0.08,
          gain: 0.052 - index * 0.006,
          attack: 0.045 + index * 0.02,
          type: index < 3 ? "sine" : "triangle",
          pan: (index - 2) * 0.24,
          reverb: 0.86
        });
      });
      scheduleNoise({
        time: start + 0.01,
        duration: 0.62,
        gain: 0.07,
        filterType: "highpass",
        frequency: 1300,
        endFrequency: 7600,
        resonance: 0.4,
        reverb: 0.82,
        swell: true
      });
      return;
    }

    if (name === "crack-light") {
      const crackIndex = Math.max(
        0,
        Math.min(4, Math.round((strength - 0.64) / 0.09))
      );
      const crackPan = [-0.62, 0.42, 0.68, -0.36, 0.04][crackIndex];
      const lightPitch = [146.83, 174.61, 220, 261.63, 293.66][crackIndex];

      // Stone/glass transient: a brittle edge, a heavy body, and a short
      // pressure thump. Each crack occupies its actual side of the eye.
      scheduleNoise({
        time: start,
        duration: 0.085,
        gain: 0.17 + strength * 0.085,
        attack: 0.001,
        filterType: "highpass",
        frequency: 7200 - crackIndex * 420,
        endFrequency: 1900,
        resonance: 0.52,
        pan: crackPan,
        reverb: 0.38
      });
      scheduleTone({
        time: start,
        frequency: 128 + strength * 72,
        endFrequency: 42,
        duration: 0.46,
        gain: 0.135 + strength * 0.07,
        attack: 0.002,
        type: "triangle",
        pan: crackPan * 0.48,
        reverb: 0.28
      });
      scheduleNoise({
        time: start + 0.006,
        duration: 0.38,
        gain: 0.12 + strength * 0.075,
        attack: 0.001,
        filterType: "bandpass",
        frequency: 1750 + crackIndex * 230,
        endFrequency: 280,
        resonance: 1.65,
        pan: crackPan,
        reverb: 0.5
      });
      // The crack leaks a pitched, widening light resonance after the impact.
      scheduleTone({
        time: start + 0.035,
        frequency: lightPitch,
        endFrequency: lightPitch * 1.008,
        duration: 1.2 + crackIndex * 0.1,
        gain: 0.052 + crackIndex * 0.006,
        attack: 0.12,
        type: "sine",
        pan: crackPan,
        reverb: 0.82
      });
      scheduleTone({
        time: start + 0.055,
        frequency: lightPitch * 2.01,
        endFrequency: lightPitch * 2,
        duration: 0.82 + crackIndex * 0.08,
        gain: 0.025 + crackIndex * 0.003,
        attack: 0.16,
        type: "triangle",
        pan: crackPan * -0.55,
        reverb: 0.9
      });
      return;
    }

    if (name === "splinter") {
      // The impact comes first; the bright harmonic bloom follows a fraction
      // later so it reads as an explosion *into* light rather than a gunshot.
      scheduleNoise({
        time: start,
        duration: 1.8,
        gain: 0.46,
        attack: 0.001,
        filterType: "bandpass",
        frequency: 760,
        endFrequency: 42,
        resonance: 1.45,
        reverb: 0.42
      });
      scheduleTone({
        time: start,
        frequency: 62,
        endFrequency: 19,
        duration: 2.15,
        gain: 0.43,
        attack: 0.003,
        type: "sine",
        reverb: 0.22
      });
      scheduleTone({
        time: start + 0.012,
        frequency: 124,
        endFrequency: 31,
        duration: 1.28,
        gain: 0.26,
        attack: 0.002,
        type: "triangle",
        pan: -0.14,
        reverb: 0.34
      });
      scheduleNoise({
        time: start + 0.016,
        duration: 0.26,
        gain: 0.34,
        attack: 0.001,
        filterType: "highpass",
        frequency: 8800,
        endFrequency: 620,
        resonance: 0.45,
        reverb: 0.62
      });
      [110, 164.81, 220, 293.66, 440, 659.25].forEach(
        (frequency, index) => {
          scheduleTone({
            time: start + 0.055 + index * 0.014,
            frequency: frequency * 0.94,
            endFrequency: frequency,
            duration: 3.5 - index * 0.2,
            gain: 0.072 - index * 0.007,
            attack: 0.22 + index * 0.045,
            type: index < 3 ? "sine" : "triangle",
            pan: (index - 2.5) * 0.16,
            reverb: 0.92
          });
        }
      );
      scheduleNoise({
        time: start + 0.07,
        duration: 2.75,
        gain: 0.12,
        attack: 0.08,
        filterType: "highpass",
        frequency: 1100,
        endFrequency: 6400,
        resonance: 0.3,
        reverb: 0.96
      });
      return;
    }

    if (name === "parry-pulse") {
      scheduleTone({
        time: start,
        frequency: 55,
        endFrequency: 82.41,
        duration: 0.54,
        gain: 0.042,
        attack: 0.018,
        type: "sine",
        reverb: 0.34
      });
      scheduleNoise({
        time: start,
        duration: 0.46,
        gain: 0.045,
        filterType: "bandpass",
        frequency: 420,
        endFrequency: 5400,
        resonance: 1.3,
        reverb: 0.68,
        swell: true
      });
      [-0.46, 0, 0.46].forEach((pan, index) => {
        scheduleNoise({
          time: start + 0.035 + index * 0.038,
          duration: 0.075 + index * 0.018,
          gain: 0.032 + index * 0.006,
          attack: 0.001,
          filterType: "bandpass",
          frequency: 3800 - index * 560,
          endFrequency: 740 + index * 90,
          resonance: 2.8,
          pan,
          reverb: 0.44
        });
      });
      [220, 329.63, 440].forEach((frequency, index) => {
        scheduleTone({
          time: start + index * 0.035,
          frequency: frequency * 0.82,
          endFrequency: frequency,
          duration: 0.5 - index * 0.045,
          gain: 0.035 - index * 0.006,
          attack: 0.12,
          type: index ? "triangle" : "sine",
          pan: (index - 1) * 0.3,
          reverb: 0.7
        });
      });
      scheduleDecoChime({
        time: start + 0.16,
        frequency: 293.66,
        gain: 0.026,
        duration: 0.62,
        reverb: 0.78
      });
      scheduleDecoChime({
        time: start + 0.245,
        frequency: 587.33,
        gain: 0.016,
        duration: 0.52,
        pan: 0.34,
        reverb: 0.86
      });
      return;
    }

    if (name === "reflect") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.78,
        pitch: 82.41,
        bright: 1,
        duration: 0.48,
        reverb: 0.52
      });
      scheduleNoise({
        time: start,
        duration: 0.2,
        gain: 0.075,
        attack: 0.001,
        filterType: "highpass",
        frequency: 4200,
        endFrequency: 9800,
        resonance: 0.48,
        reverb: 0.62
      });
      [587.33, 880, 1174.66].forEach((frequency, index) => {
        scheduleTone({
          time: start + index * 0.014,
          frequency,
          endFrequency: frequency * 1.08,
          duration: 0.38 - index * 0.04,
          gain: 0.038 - index * 0.007,
          attack: 0.003,
          type: "triangle",
          pan: (index - 1) * 0.34,
          reverb: 0.72
        });
      });
      [-0.62, 0.62].forEach((pan, index) => {
        scheduleDecoChime({
          time: start + 0.025 + index * 0.022,
          frequency: index ? 783.99 : 392,
          gain: 0.025 - index * 0.004,
          duration: 0.62,
          pan,
          reverb: 0.78
        });
      });
      scheduleTone({
        time: start + 0.018,
        frequency: 146.83,
        endFrequency: 220,
        duration: 0.48,
        gain: 0.032,
        attack: 0.008,
        type: "sine",
        reverb: 0.42
      });
      return;
    }

    if (name === "ward-hit") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.52,
        pitch: 92.5,
        bright: 0.72,
        duration: 0.44,
        reverb: 0.46
      });
      scheduleDecoChime({
        time: start + 0.008,
        frequency: 196,
        gain: 0.033,
        duration: 0.48,
        pan: -0.12,
        reverb: 0.58
      });
      scheduleTone({
        time: start + 0.035,
        frequency: 311.13,
        endFrequency: 103.83,
        duration: 0.38,
        gain: 0.034,
        attack: 0.004,
        type: "sawtooth",
        reverb: 0.35
      });
      return;
    }

    if (
      name === "anchor-break" ||
      name === "minion-break" ||
      name === "debris-break"
    ) {
      const anchorBreak = name === "anchor-break";
      const debrisBreak = name === "debris-break";
      const breakScale = anchorBreak ? 1 : (debrisBreak ? 0.56 : 0.82);
      const breakPitch = anchorBreak ? 46 : (debrisBreak ? 96 : 64);
      scheduleCinematicImpact({
        time: start,
        strength: breakScale * strength,
        pitch: breakPitch,
        bright: debrisBreak ? 0.82 : 0.58,
        duration: anchorBreak ? 1.05 : (debrisBreak ? 0.46 : 0.72),
        reverb: anchorBreak ? 0.58 : 0.42
      });
      [0, 0.035, 0.082].forEach((delay, index) => {
        scheduleNoise({
          time: start + delay,
          duration: 0.16 + index * 0.045,
          gain: breakScale * strength * (0.062 - index * 0.009),
          attack: 0.001,
          filterType: index === 0 ? "highpass" : "bandpass",
          frequency: (debrisBreak ? 4600 : 2800) + index * 720,
          endFrequency: 420 + index * 120,
          resonance: 0.7 + index * 0.35,
          pan: (index - 1) * 0.42,
          reverb: 0.48
        });
      });
      scheduleDecoChime({
        time: start + 0.025,
        frequency: anchorBreak ? 110 : (debrisBreak ? 293.66 : 174.61),
        gain: breakScale * strength * 0.044,
        duration: anchorBreak ? 1.1 : 0.64,
        pan: name === "minion-break" ? 0.18 : -0.12,
        reverb: anchorBreak ? 0.72 : 0.5
      });
      return;
    }

    if (name === "debris-impact") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.86 * strength,
        pitch: 52,
        bright: 0.6,
        duration: 0.82,
        reverb: 0.42
      });
      scheduleNoise({
        time: start + 0.018,
        duration: 0.42,
        gain: 0.085 * strength,
        attack: 0.002,
        filterType: "bandpass",
        frequency: 1180,
        endFrequency: 95,
        resonance: 1.05,
        reverb: 0.38
      });
      return;
    }

    if (name === "player-hit") {
      scheduleCinematicImpact({
        time: start,
        strength: 0.68 * strength,
        pitch: 78,
        bright: 0.82,
        duration: 0.48,
        reverb: 0.26
      });
      scheduleTone({
        time: start + 0.012,
        frequency: 466.16,
        endFrequency: 92.5,
        duration: 0.43,
        gain: 0.052 * strength,
        attack: 0.003,
        type: "sawtooth",
        pan: -0.18,
        reverb: 0.3
      });
      return;
    }

    if (name === "enemy-shot") {
      scheduleNoise({
        time: start,
        duration: 0.22,
        gain: 0.048 * strength,
        attack: 0.002,
        filterType: "bandpass",
        frequency: 5100,
        endFrequency: 620,
        resonance: 1.5,
        reverb: 0.34
      });
      scheduleTone({
        time: start,
        frequency: 196 + strength * 92,
        endFrequency: 73.5,
        duration: 0.28,
        gain: 0.05 * strength,
        attack: 0.003,
        type: "triangle",
        reverb: 0.28
      });
      scheduleDecoChime({
        time: start + 0.02,
        frequency: 220,
        gain: 0.018 * strength,
        duration: 0.34,
        reverb: 0.42
      });
      return;
    }

    if (name === "ricochet-ring") {
      const ringPans = [-0.72, -0.36, 0, 0.36, 0.72, 0.42, -0.12];
      const ringFrequencies = [196, 261.63, 329.63, 392, 493.88, 587.33, 783.99];
      ringPans.forEach((pan, index) => {
        scheduleDecoChime({
          time: start + index * 0.021,
          frequency: ringFrequencies[index],
          gain: (0.014 + strength * 0.008) * (1 - index * 0.045),
          duration: 0.48 + index * 0.045,
          pan,
          reverb: 0.78
        });
        scheduleNoise({
          time: start + index * 0.021,
          duration: 0.052,
          gain: 0.012 + strength * 0.007,
          attack: 0.001,
          filterType: "bandpass",
          frequency: 5200 + index * 310,
          endFrequency: 1200 + index * 75,
          resonance: 2.5,
          pan,
          reverb: 0.32
        });
      });
      scheduleNoise({
        time: start,
        duration: 0.24,
        gain: 0.036 * strength,
        attack: 0.002,
        filterType: "bandpass",
        frequency: 2400,
        endFrequency: 820,
        resonance: 2.2,
        reverb: 0.5
      });
      scheduleTone({
        time: start,
        frequency: 65.41,
        endFrequency: 43.65,
        duration: 0.62,
        gain: 0.048 * strength,
        attack: 0.006,
        type: "sine",
        reverb: 0.38
      });
      return;
    }

    if (name === "victory") {
      scheduleBossEndingScore(context, start);
      return;
    }

    if (name === "phase-break") {
      scheduleCinematicImpact({
        time: start,
        strength: 1.08,
        pitch: 36.75,
        bright: 0.68,
        duration: 1.35,
        reverb: 0.62
      });
      scheduleNoise({
        time: start + 0.02,
        duration: 1.05,
        gain: 0.14,
        filterType: "bandpass",
        frequency: 4600,
        endFrequency: 120,
        resonance: 1.05,
        reverb: 0.72
      });
      [73.5, 77.78, 110, 116.54].forEach((frequency, index) => {
        scheduleTone({
          time: start + 0.035 + index * 0.026,
          frequency,
          endFrequency: frequency * 0.72,
          duration: 1.05 - index * 0.08,
          gain: 0.056 - index * 0.006,
          attack: 0.025,
          type: index < 2 ? "sine" : "triangle",
          pan: (index - 1.5) * 0.24,
          reverb: 0.68
        });
      });
      return;
    }

    if (name === "phase") {
      const phaseNumber = Math.max(1, Math.min(3, Math.round(intensity)));
      const root = [73.5, 69.3, 61.74][phaseNumber - 1];
      scheduleCinematicImpact({
        time: start,
        strength: 0.62 + phaseNumber * 0.14,
        pitch: root * 0.5,
        bright: 0.46 + phaseNumber * 0.12,
        duration: 0.92 + phaseNumber * 0.12,
        reverb: 0.56
      });
      [1, 1.5, 2, 2.5, 3].forEach((multiple, index) => {
        scheduleTone({
          time: start + 0.045 + index * 0.04,
          frequency: root * multiple * 0.84,
          endFrequency: root * multiple,
          duration: 1.15 - index * 0.08,
          gain: 0.052 - index * 0.006,
          attack: 0.2 + index * 0.04,
          type: index < 3 ? "sine" : "triangle",
          pan: (index - 2) * 0.2,
          reverb: 0.76
        });
      });
      scheduleNoise({
        time: start,
        duration: 0.95,
        gain: 0.075,
        filterType: "highpass",
        frequency: 580,
        endFrequency: 7200,
        resonance: 0.42,
        reverb: 0.7,
        swell: true
      });
      return;
    }

    if (name === "player-death") {
      playSoundAsset("fallDeath", 0.78);
      scheduleNoise({
        time: start,
        duration: 0.9,
        gain: 0.065,
        filterType: "bandpass",
        frequency: 6200,
        endFrequency: 180,
        resonance: 0.8,
        reverb: 0.56
      });
      [293.66, 220, 146.83, 110].forEach((frequency, index) => {
        scheduleTone({
          time: start + index * 0.07,
          frequency,
          endFrequency: frequency * 0.48,
          duration: 0.72 + index * 0.08,
          gain: 0.036 - index * 0.004,
          attack: 0.008,
          type: index < 2 ? "triangle" : "sine",
          pan: (index - 1.5) * 0.24,
          reverb: 0.62
        });
      });
      return;
    }
  }

  function getBossFightWorld(rect = easterEggCanvas.getBoundingClientRect()) {
    const eyeGeometry = getEyeGeometry(
      eyeCanvas.offsetWidth,
      eyeCanvas.offsetHeight
    );
    return {
      width: rect.width,
      height: rect.height,
      groundY: easterEggState.groundY,
      platformBounds: getEasterEggPlatformBounds(rect.width),
      player: easterEggState.player,
      keys: easterEggState.keys,
      eye: {
        x: rect.width * 0.5,
        y: Math.max(82, Math.min(108, rect.height * 0.105)),
        radius: Math.max(34, eyeGeometry.eyeballRadius),
        halfWidth: eyeGeometry.eyeHalfWidth,
        halfHeight: eyeGeometry.eyeHalfHeight
      }
    };
  }

  function handleBossPlayerDeath(reason) {
    const player = easterEggState.player;
    player.respawnTimer = Math.max(player.respawnTimer, 2.75);
    player.grounded = false;
    player.dashTime = 0;
    player.slideTime = 0;
    player.trail = [];
    easterEggState.keys.clear();
    if (reason === "fall") {
      playFallDeathSound();
    }
    easterEggStage.dataset.motion = "fallen";
  }

  function setBossDeathMode(enabled) {
    document.body.classList.toggle("boss-death-scene", enabled);
    easterEggStage.classList.toggle("is-death-scene", enabled);
  }

  function setBossVictoryMode(enabled) {
    document.body.classList.toggle("boss-victory-scene", enabled);
    easterEggStage.classList.toggle("is-victory-scene", enabled);
    if (!enabled) {
      document.body.classList.remove("boss-splintered");
    }
    if (enabled) {
      easterEggState.keys.clear();
    }
  }

  function setBossCursorMode(enabled) {
    document.body.classList.toggle("boss-cursor-phase", enabled);
    easterEggStage.classList.toggle("is-cursor-phase", enabled);
    cursor.classList.toggle("is-parry-cursor", enabled);
  }

  function initializeBossEncounter() {
    if (
      bossEncounter ||
      typeof window.createEyeBossEncounter !== "function"
    ) {
      return;
    }
    bossEncounter = window.createEyeBossEncounter({
      stage: easterEggStage,
      bossHealthFill,
      bossPhaseLabel,
      bossObjective,
      playerHealthPips,
      threadChargePips,
      onCue: playCombatSoundCue,
      onPhaseChange: setBossMusicPhase,
      onPlayerDeath: handleBossPlayerDeath,
      onCursorMode: setBossCursorMode,
      onDeathMode: setBossDeathMode,
      onVictoryMode: setBossVictoryMode,
      timerDisplay: bossTimer,
      heartsDisplay: bossHeartsLost,
      resultTimeDisplay: resultTime,
      resultHeartsDisplay: resultHeartsLost,
      resultPanel: encounterResult
    });
  }

  function drawTrackedText(
    context,
    text,
    x,
    y,
    tracking = 0,
    alignment = "center"
  ) {
    const characters = [...text];
    const widths = characters.map((character) => (
      context.measureText(character).width
    ));
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, characters.length - 1) * tracking;
    let cursorX = alignment === "right"
      ? x - totalWidth
      : alignment === "left"
        ? x
        : x - totalWidth * 0.5;

    context.save();
    context.textAlign = "left";
    characters.forEach((character, index) => {
      context.fillText(character, cursorX, y);
      cursorX += widths[index] + tracking;
    });
    context.restore();
  }

  function drawResultCardCorner(context, x, y, scaleX, scaleY) {
    context.save();
    context.translate(x, y);
    context.scale(scaleX, scaleY);
    context.beginPath();
    context.moveTo(0, 54);
    context.lineTo(0, 16);
    context.lineTo(16, 0);
    context.lineTo(54, 0);
    context.moveTo(10, 54);
    context.lineTo(10, 24);
    context.lineTo(24, 10);
    context.lineTo(54, 10);
    context.moveTo(0, 38);
    context.lineTo(19, 19);
    context.stroke();
    context.restore();
  }

  function createBossResultCard(time, hearts) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 675;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#0b111a");
    background.addColorStop(0.55, "#070b12");
    background.addColorStop(1, "#05070b");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const crownGlow = context.createRadialGradient(
      width * 0.5,
      118,
      0,
      width * 0.5,
      118,
      440
    );
    crownGlow.addColorStop(0, "rgb(105 221 255 / 0.1)");
    crownGlow.addColorStop(0.48, "rgb(34 57 74 / 0.08)");
    crownGlow.addColorStop(1, "rgb(7 11 18 / 0)");
    context.fillStyle = crownGlow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.strokeStyle = "rgb(133 143 153 / 0.34)";
    context.lineWidth = 1;
    context.strokeRect(32.5, 32.5, width - 65, height - 65);
    context.strokeStyle = "rgb(255 240 72 / 0.18)";
    context.strokeRect(42.5, 42.5, width - 85, height - 85);
    context.strokeStyle = "rgb(181 194 203 / 0.68)";
    drawResultCardCorner(context, 53, 53, 1, 1);
    drawResultCardCorner(context, width - 53, 53, -1, 1);
    drawResultCardCorner(context, 53, height - 53, 1, -1);
    drawResultCardCorner(context, width - 53, height - 53, -1, -1);
    context.restore();

    context.save();
    context.translate(width * 0.5, 204);
    context.strokeStyle = "rgb(105 221 255 / 0.075)";
    context.lineWidth = 1;
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const inner = index % 2 ? 86 : 108;
      const outer = index % 3 ? 176 : 204;
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.38);
      context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.38);
      context.stroke();
    }
    context.restore();

    context.fillStyle = "rgb(255 240 72 / 0.78)";
    context.font = "12px 'Courier New', monospace";
    drawTrackedText(
      context,
      "THE UNQUIET EYE / COMPLETE",
      width * 0.5,
      108,
      3.2
    );

    context.fillStyle = "#e8fbff";
    context.font = "52px Georgia, serif";
    drawTrackedText(context, "THE GAZE IS BROKEN", width * 0.5, 183, 2.2);

    context.strokeStyle = "rgb(105 221 255 / 0.32)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(370, 224.5);
    context.lineTo(830, 224.5);
    context.stroke();

    [
      { label: "TIME", value: time, x: 480 },
      { label: "HEARTS LOST", value: String(hearts), x: 720 }
    ].forEach((stat) => {
      context.fillStyle = "rgb(164 176 187 / 0.82)";
      context.font = "12px 'Courier New', monospace";
      drawTrackedText(context, stat.label, stat.x, 285, 2.4);
      context.fillStyle = "#e8fbff";
      context.font = "28px 'Courier New', monospace";
      drawTrackedText(context, stat.value, stat.x, 327, 1.1);
    });

    const groundY = 548;
    context.strokeStyle = "rgb(133 143 153 / 0.7)";
    context.lineWidth = 1.35;
    context.beginPath();
    context.moveTo(84, groundY + 0.5);
    context.lineTo(width - 84, groundY + 0.5);
    context.stroke();
    [84, width - 84].forEach((x) => {
      context.save();
      context.translate(x, groundY);
      context.rotate(Math.PI / 4);
      context.strokeStyle = "rgb(181 194 203 / 0.82)";
      context.strokeRect(-5, -5, 10, 10);
      context.restore();
    });

    const resultPlayer = {
      x: 166,
      y: groundY,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      dashTime: 0,
      slideTime: 0,
      walkPhase: 0,
      idlePhase: 0,
      crouchBlend: 0,
      crawlBlend: 0,
      landingSquash: 0,
      takeoffStretch: 0
    };
    context.save();
    context.translate(resultPlayer.x, resultPlayer.y);
    context.scale(1.55, 1.55);
    context.translate(-resultPlayer.x, -resultPlayer.y);
    drawPolygonCharacter(context, resultPlayer, 1, false, new Set());
    context.restore();

    context.fillStyle = "rgb(164 176 187 / 0.72)";
    context.font = "11px 'Courier New', monospace";
    drawTrackedText(
      context,
      "COMPLETED IN YUVAN'S PORTFOLIO",
      width - 82,
      590,
      1.55,
      "right"
    );
    context.fillStyle = "rgb(255 31 45 / 0.84)";
    context.fillRect(width - 92, 608, 10, 2);

    let noiseSeed = 173;
    context.fillStyle = "rgb(255 255 255 / 0.055)";
    for (let index = 0; index < 1450; index += 1) {
      noiseSeed = (noiseSeed * 16807) % 2147483647;
      const x = noiseSeed / 2147483647 * width;
      noiseSeed = (noiseSeed * 16807) % 2147483647;
      const y = noiseSeed / 2147483647 * height;
      context.fillRect(x, y, 0.7, 0.7);
    }

    return canvas;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to render result image."));
        }
      }, "image/png");
    });
  }

  function downloadBossResultImage(file) {
    const downloadUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1200);
  }

  async function shareBossResult() {
    const time = resultTime?.textContent || "00:00.0";
    const hearts = resultHeartsLost?.textContent || "0";
    const text = `I broke The Unquiet Eye in ${time}, losing ${hearts} hearts.`;
    encounterShare?.setAttribute("aria-busy", "true");
    if (encounterShareStatus) {
      encounterShareStatus.textContent = "Rendering result…";
    }
    try {
      const canvas = createBossResultCard(time, hearts);
      const blob = await canvasToPngBlob(canvas);
      const safeTime = time.replace(/[^0-9]+/g, "-").replace(/-+$/g, "");
      const file = new File(
        [blob],
        `the-unquiet-eye-${safeTime || "result"}.png`,
        { type: "image/png" }
      );
      const shareData = {
        title: "The Unquiet Eye",
        text,
        files: [file]
      };
      const canShareImage = Boolean(
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      );

      if (canShareImage) {
        await navigator.share(shareData);
        if (encounterShareStatus) {
          encounterShareStatus.textContent = "Image shared.";
        }
      } else {
        downloadBossResultImage(file);
        if (encounterShareStatus) {
          encounterShareStatus.textContent = "Result image downloaded.";
        }
      }
    } catch (error) {
      if (encounterShareStatus) {
        encounterShareStatus.textContent = error?.name === "AbortError"
          ? "Share cancelled."
          : "Unable to create result image.";
      }
    } finally {
      encounterShare?.removeAttribute("aria-busy");
    }
  }

  encounterShare?.addEventListener("click", shareBossResult);

  function stopEasterEggSounds() {
    stopSoundSources(soundState.sequenceSources);
    stopSoundSources(soundState.effectSources);
    stopSoundAssets();
    easterEggStage.removeAttribute("data-sound-cue");
    easterEggStage.removeAttribute("data-sound-asset");
    easterEggStage.removeAttribute("data-sound-bed");
  }

  function updateSelectionAccent() {
    document.documentElement.style.setProperty(
      "--selection-accent-rgb",
      selectionAccentByIrritation[irritationLevel]
    );
  }

  function isDesktopEasterEggAvailable() {
    return window.innerWidth > 820;
  }

  function scheduleEasterEggAction(callback, delay) {
    const timer = window.setTimeout(() => {
      easterEggState.timers = easterEggState.timers.filter(
        (candidate) => candidate !== timer
      );
      callback();
    }, delay);

    easterEggState.timers.push(timer);
    return timer;
  }

  function clearEasterEggTimers() {
    easterEggState.timers.forEach((timer) => window.clearTimeout(timer));
    easterEggState.timers = [];
  }

  function easeOutCubic(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return 1 - Math.pow(1 - clamped, 3);
  }

  function resizeEasterEggCanvas(resetPlayer = false) {
    const rect = easterEggCanvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    easterEggCanvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    easterEggCanvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    easterEggContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const previousGroundY = easterEggState.groundY;
    easterEggState.groundY = Math.round(
      rect.height - Math.max(78, Math.min(112, rect.height * 0.12))
    );

    const player = easterEggState.player;
    if (resetPlayer || !player.x) {
      player.x = rect.width / 2;
      player.y = easterEggState.groundY;
      player.vx = 0;
      player.vy = 0;
      player.grounded = true;
      player.walkPhase = 0;
      player.idlePhase = 0;
      player.animationTime = 0;
      player.dashTime = 0;
      player.dashCooldown = 0;
      player.slideTime = 0;
      player.slideDirection = 0;
      player.airDashUsed = false;
      player.dashBufferTimer = 0;
      player.coyoteTimer = COYOTE_TIME_SECONDS;
      player.jumpBufferTimer = 0;
      player.landingSquash = 0;
      player.turnImpact = 0;
      player.takeoffStretch = 0;
      player.crouchImpact = 0;
      player.slideImpact = 0;
      player.crouchBlend = 0;
      player.crawlBlend = 0;
      player.respawnTimer = 0;
      player.trail = [];
      soundState.dashAvailable = true;
      updateEasterEggDashStatus();
    } else {
      player.x = Math.max(38, Math.min(rect.width - 38, player.x));
      if (player.grounded || player.y >= previousGroundY - 1) {
        player.y = easterEggState.groundY;
      } else {
        player.y = Math.min(player.y, easterEggState.groundY);
      }
    }
  }

  function drawPolygon(context, points, fill, stroke, lineWidth = 1) {
    if (!points.length) {
      return;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function drawLimbPolygon(
    context,
    start,
    end,
    startWidth,
    endWidth,
    fill,
    stroke,
    lineWidth
  ) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const normalX = -dy / distance;
    const normalY = dx / distance;

    drawPolygon(context, [
      {
        x: start.x + normalX * startWidth,
        y: start.y + normalY * startWidth
      },
      {
        x: end.x + normalX * endWidth,
        y: end.y + normalY * endWidth
      },
      {
        x: end.x - normalX * endWidth,
        y: end.y - normalY * endWidth
      },
      {
        x: start.x - normalX * startWidth,
        y: start.y - normalY * startWidth
      }
    ], fill, stroke, lineWidth);
  }

  function drawJointDiamond(
    context,
    point,
    size,
    fill,
    stroke,
    lineWidth = 1
  ) {
    drawPolygon(context, [
      { x: point.x, y: point.y - size },
      { x: point.x + size, y: point.y },
      { x: point.x, y: point.y + size },
      { x: point.x - size, y: point.y }
    ], fill, stroke, lineWidth);
  }

  function drawArmouredBoot(
    context,
    ankle,
    direction,
    fill,
    stroke,
    lineWidth
  ) {
    const facing = direction || 1;
    const localPoints = [
      { x: -3.5, y: -4.5 },
      { x: 3.5, y: -3.8 },
      { x: 8.5, y: -0.8 },
      { x: 7.5, y: 1.2 },
      { x: -4.5, y: 1.2 },
      { x: -5.5, y: -1.5 }
    ];
    drawPolygon(
      context,
      localPoints.map((point) => ({
        x: ankle.x + point.x * facing,
        y: ankle.y + point.y
      })),
      fill,
      stroke,
      lineWidth
    );
  }

  function drawArmouredGauntlet(
    context,
    hand,
    elbow,
    fill,
    stroke,
    lineWidth
  ) {
    const dx = hand.x - elbow.x;
    const dy = hand.y - elbow.y;
    const distance = Math.hypot(dx, dy) || 1;
    const directionX = dx / distance;
    const directionY = dy / distance;
    const normalX = -directionY;
    const normalY = directionX;

    drawPolygon(context, [
      {
        x: hand.x + directionX * 4.2,
        y: hand.y + directionY * 4.2
      },
      {
        x: hand.x + normalX * 3,
        y: hand.y + normalY * 3
      },
      {
        x: hand.x - directionX * 3.5,
        y: hand.y - directionY * 3.5
      },
      {
        x: hand.x - normalX * 3,
        y: hand.y - normalY * 3
      }
    ], fill, stroke, lineWidth);
  }

  function drawPolygonCharacter(
    context,
    player,
    alpha = 1,
    ghost = false,
    inputKeys = easterEggState.keys
  ) {
    const characterScale = 0.76;
    context.save();
    context.translate(player.x, player.y);
    context.scale(characterScale, characterScale);
    context.translate(-player.x, -player.y);

    const speedRatio = Math.min(1, Math.abs(player.vx) / RUN_SPEED);
    const dashing = player.dashTime > 0;
    const sliding = player.slideTime > 0;
    const facing = player.facing || 1;
    const slideFacing = player.slideDirection || facing;
    if (dashing) {
      const stretchCenterY = player.y - 42;
      context.translate(player.x, stretchCenterY);
      context.scale(1.13, 0.92);
      context.translate(-player.x, -stretchCenterY);
    }
    const horizontalInputHeld = (
      inputKeys.has("a") ||
      inputKeys.has("d")
    );
    const crouchRequested = (
      player.grounded &&
      inputKeys.has("s") &&
      !horizontalInputHeld &&
      !dashing &&
      !sliding
    );
    const crawlRequested = (
      player.grounded &&
      inputKeys.has("s") &&
      horizontalInputHeld &&
      !dashing &&
      !sliding
    );
    const crouching = (
      !horizontalInputHeld &&
      !dashing &&
      !sliding &&
      (crouchRequested || (player.crouchBlend || 0) > 0.04)
    );
    const crawling = (
      horizontalInputHeld &&
      !dashing &&
      !sliding &&
      (crawlRequested || (player.crawlBlend || 0) > 0.04)
    );
    const idling = (
      player.grounded &&
      !dashing &&
      !sliding &&
      !crouching &&
      !crawling &&
      speedRatio < 0.08
    );
    const idleTime = player.idlePhase || 0;
    const idleCycle = idling ? (idleTime % 2.6) / 2.6 : 0;
    const idleArc = idling ? Math.sin(idleCycle * Math.PI * 2) : 0;
    const idleCompression = idling
      ? (1 - Math.cos(idleCycle * Math.PI * 2)) * 0.5
      : 0;
    const idleBreath = -idleCompression * 0.9;
    const idleWeight = idleArc * 1.25;
    const guardBob = idleArc * 0.85;
    const combatBounce = idleCompression * 2.25;
    const bob = player.grounded && !dashing && !sliding &&
      !crouching && !crawling
      ? Math.abs(Math.sin(player.walkPhase * 2)) * 2.15 * speedRatio
      : -1.5;
    const strideWave = Math.sin(player.walkPhase || 0) * speedRatio;
    const runSway = player.grounded && !dashing && !sliding &&
      !crouching && !crawling
      ? strideWave * 4.2
      : 0;
    const runLean = player.grounded && !dashing && !sliding &&
      !crouching && !crawling
      ? Math.sign(player.vx) * speedRatio * 6.2
      : 0;
    const idleDrift = idling
      ? idleWeight
      : 0;
    const takeoffStretch = player.takeoffStretch || 0;
    const dashLean = sliding
      ? player.slideDirection * 18
      : (dashing ? player.dashDirectionX * 16 : player.vx / 78);
    const crouchDrop = crawling ? 30 : (crouching ? 21 : 0);
    const landingDrop = player.grounded && !sliding
      ? player.landingSquash
      : 0;
    const poseDrop = (sliding ? 18 : crouchDrop) + landingDrop +
      combatBounce;
    const originX = player.x;
    const originY = player.y;
    const outlineAlpha = ghost ? alpha * 0.42 : alpha * 0.94;
    const fillAlpha = ghost ? alpha * 0.075 : alpha * 0.94;
    const rearFillAlpha = ghost ? alpha * 0.04 : alpha * 0.72;
    const insetAlpha = ghost ? alpha * 0.04 : alpha * 0.78;
    const fill = `rgb(8 13 20 / ${fillAlpha})`;
    const rearFill = `rgb(8 13 20 / ${rearFillAlpha})`;
    const insetFill = `rgb(25 34 44 / ${insetAlpha})`;
    const capeFill = ghost
      ? `rgb(16 23 32 / ${alpha * 0.08})`
      : `rgb(26 36 48 / ${alpha * 0.96})`;
    const capeStroke = ghost
      ? `rgb(180 193 203 / ${alpha * 0.36})`
      : `rgb(181 194 203 / ${alpha * 0.9})`;
    const stroke = `rgb(202 214 222 / ${outlineAlpha})`;
    const brightStroke = `rgb(235 241 244 / ${outlineAlpha})`;
    const jointFill = `rgb(82 94 105 / ${outlineAlpha * 0.82})`;
    const jointStroke = `rgb(190 201 210 / ${outlineAlpha * 0.78})`;
    const accent = `rgb(255 31 45 / ${ghost ? 0 : alpha * 0.92})`;
    const bodyLineWidth = ghost ? 0.8 : 1.15;
    const crouchBlend = easeOutCubic(player.crouchBlend || 0);
    const crawlBlend = easeOutCubic(player.crawlBlend || 0);
    const crawlMotion = crawling
      ? Math.sin(player.walkPhase || 0)
      : 0;
    const mixPoint = (from, to, amount) => ({
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount
    });
    const crouchHip = {
      x: originX - facing * 4 * crouchBlend,
      y: originY - 37 + 14 * crouchBlend
    };
    const crouchShoulder = {
      x: originX + facing * 3 * crouchBlend,
      y: originY - 62 + 16 * crouchBlend
    };
    const crouchNeck = {
      x: originX + facing * 7 * crouchBlend,
      y: originY - 69 + 15 * crouchBlend
    };
    const crouchHead = {
      x: originX + facing * 11 * crouchBlend,
      y: originY - 82 + 16 * crouchBlend
    };

    const hip = sliding
      ? {
        x: originX + slideFacing * 2,
        y: originY - 14
      }
      : crawling
      ? mixPoint(crouchHip, {
        x: originX - facing * (11 - crawlMotion * 1.5),
        y: originY - 9 + crawlMotion * 0.65
      }, crawlBlend)
      : crouching
      ? crouchHip
      : {
        x: originX + dashLean * 0.16 - runSway * 0.22,
        y: originY - 37 + poseDrop + bob + takeoffStretch * 1.5
      };
    const shoulder = sliding
      ? {
        x: originX - slideFacing * 11,
        y: originY - 30
      }
      : crawling
      ? mixPoint(crouchShoulder, {
        x: originX + facing * (7 + crawlMotion * 1.5),
        y: originY - 12 - crawlMotion * 0.55
      }, crawlBlend)
      : crouching
      ? crouchShoulder
      : {
        x: originX + dashLean * 0.62 + runSway + runLean + idleDrift,
        y: originY - 62 + poseDrop + bob + idleBreath -
          Math.abs(strideWave) * 1.2 - takeoffStretch * 3.2 +
          guardBob * 0.35
      };
    const neck = sliding
      ? {
        x: originX - slideFacing * 8,
        y: originY - 38
      }
      : crawling
      ? mixPoint(crouchNeck, {
        x: originX + facing * (17 + crawlMotion),
        y: originY - 15
      }, crawlBlend)
      : crouching
      ? crouchNeck
      : {
        x: originX + dashLean * 0.78 + runSway * 1.12 + runLean +
          idleDrift,
        y: originY - 69 + poseDrop + bob + idleBreath -
          takeoffStretch * 4.2 + guardBob * 0.22
      };
    const headCenter = sliding
      ? {
        x: originX - slideFacing * 5,
        y: originY - 49
      }
      : crawling
      ? mixPoint(crouchHead, {
        x: originX + facing * (26 + crawlMotion * 1.4),
        y: originY - 22 - Math.abs(crawlMotion) * 0.7
      }, crawlBlend)
      : crouching
      ? crouchHead
      : {
        x: originX + dashLean + runSway * 1.18 + runLean +
          idleDrift * 1.2,
        y: originY - 82 + poseDrop + bob + idleBreath -
          Math.abs(strideWave) * 0.65 - takeoffStretch * 5.4
      };

    let leftFoot;
    let rightFoot;
    let leftKnee;
    let rightKnee;
    let leftHand;
    let rightHand;
    let leftElbow;
    let rightElbow;

    if (sliding) {
      const direction = slideFacing;
      leftFoot = {
        x: originX - direction * 19,
        y: originY - 1
      };
      rightFoot = {
        x: originX + direction * 40,
        y: originY
      };
      leftKnee = {
        x: originX - direction * 4,
        y: originY - 11
      };
      rightKnee = {
        x: originX + direction * 21,
        y: originY - 5
      };
      leftHand = {
        x: originX - direction * 16,
        y: originY - 16
      };
      rightHand = {
        x: originX + direction * 28,
        y: originY - 29
      };
      leftElbow = {
        x: originX - direction * 13,
        y: originY - 29
      };
      rightElbow = {
        x: originX + direction * 12,
        y: originY - 34
      };
    } else if (dashing) {
      const horizontalDirection = player.dashDirectionX || player.facing;
      const verticalDirection = player.dashDirectionY;
      leftFoot = {
        x: originX - horizontalDirection * 26,
        y: originY - 3 - verticalDirection * 8
      };
      rightFoot = {
        x: originX - horizontalDirection * 13,
        y: originY - 15 - verticalDirection * 6
      };
      leftKnee = {
        x: originX - horizontalDirection * 11,
        y: originY - 23 - verticalDirection * 3
      };
      rightKnee = {
        x: originX + horizontalDirection * 3,
        y: originY - 27 + verticalDirection * 2
      };
      leftHand = {
        x: originX + horizontalDirection * 29,
        y: originY - 51 - verticalDirection * 5
      };
      rightHand = {
        x: originX - horizontalDirection * 22,
        y: originY - 38 + verticalDirection * 4
      };
      leftElbow = {
        x: originX + horizontalDirection * 12,
        y: originY - 57 - verticalDirection * 2
      };
      rightElbow = {
        x: originX - horizontalDirection * 8,
        y: originY - 51 + verticalDirection * 2
      };
    } else if (!player.grounded) {
      const airDirection = Math.max(-1, Math.min(1, player.vy / 560));
      const rising = Math.max(0, -airDirection);
      const falling = Math.max(0, airDirection);
      leftFoot = {
        x: originX - facing * (19 - falling * 5),
        y: originY - 5 - rising * 8 + falling * 3
      };
      rightFoot = {
        x: originX + facing * (7 + falling * 8),
        y: originY - 16 - rising * 5 + falling * 4
      };
      leftKnee = {
        x: originX - facing * (11 + rising * 3),
        y: originY - 22 - rising * 6 + falling * 2
      };
      rightKnee = {
        x: originX + facing * (14 + falling * 4),
        y: originY - 30 + falling * 6
      };
      leftHand = {
        x: originX - facing * (21 + rising * 4),
        y: originY - 43 - rising * 8 + falling * 7
      };
      rightHand = {
        x: originX + facing * (24 + falling * 7),
        y: originY - 53 - rising * 4 + falling * 9
      };
      leftElbow = {
        x: originX - facing * (15 + rising * 3),
        y: originY - 55 - rising * 5 + falling * 5
      };
      rightElbow = {
        x: originX + facing * (12 + falling * 4),
        y: originY - 61 + falling * 8
      };
    } else if (crawling) {
      const crawlWave = crawlMotion;
      leftFoot = mixPoint({
        x: originX - facing * 17,
        y: originY
      }, {
        x: originX - facing * (41 - crawlWave * 4),
        y: originY
      }, crawlBlend);
      rightFoot = mixPoint({
        x: originX + facing * 21,
        y: originY
      }, {
        x: originX - facing * (34 + crawlWave * 4),
        y: originY
      }, crawlBlend);
      leftKnee = mixPoint({
        x: originX - facing * 5,
        y: originY - 11
      }, {
        x: originX - facing * (27 - crawlWave * 6),
        y: originY - 4
      }, crawlBlend);
      rightKnee = mixPoint({
        x: originX + facing * 15,
        y: originY - 13
      }, {
        x: originX - facing * (21 + crawlWave * 6),
        y: originY - 5
      }, crawlBlend);
      leftHand = mixPoint({
        x: originX + facing * 12,
        y: originY - 27
      }, {
        x: originX + facing * (22 + crawlWave * 9),
        y: originY - 1
      }, crawlBlend);
      rightHand = mixPoint({
        x: originX + facing * 28,
        y: originY - 35
      }, {
        x: originX + facing * (33 - crawlWave * 8),
        y: originY - 1
      }, crawlBlend);
      leftElbow = mixPoint({
        x: originX,
        y: originY - 36
      }, {
        x: shoulder.x + facing * (4 + crawlWave * 5),
        y: originY - 4
      }, crawlBlend);
      rightElbow = mixPoint({
        x: originX + facing * 17,
        y: originY - 43
      }, {
        x: shoulder.x + facing * (13 - crawlWave * 5),
        y: originY - 4
      }, crawlBlend);
    } else if (crouching) {
      const crouchSettle = (player.crouchImpact || 0) * 2;
      leftFoot = mixPoint({
        x: originX - facing * 11,
        y: originY - 1
      }, {
        x: originX - facing * 17,
        y: originY
      }, crouchBlend);
      rightFoot = mixPoint({
        x: originX + facing * 12,
        y: originY
      }, {
        x: originX + facing * 21,
        y: originY
      }, crouchBlend);
      leftKnee = mixPoint({
        x: originX - facing * 8,
        y: originY - 19
      }, {
        x: originX - facing * 5,
        y: originY - 11 + crouchSettle
      }, crouchBlend);
      rightKnee = mixPoint({
        x: originX + facing * 8,
        y: originY - 21
      }, {
        x: originX + facing * 15,
        y: originY - 13 + crouchSettle
      }, crouchBlend);
      leftHand = mixPoint({
        x: shoulder.x - facing * 17,
        y: shoulder.y + 20
      }, {
        x: shoulder.x + facing * 9,
        y: shoulder.y + 19
      }, crouchBlend);
      rightHand = mixPoint({
        x: shoulder.x + facing * 22,
        y: shoulder.y + 7
      }, {
        x: shoulder.x + facing * 25,
        y: shoulder.y + 11
      }, crouchBlend);
      leftElbow = mixPoint({
        x: shoulder.x - facing * 14,
        y: shoulder.y + 9
      }, {
        x: shoulder.x - facing * 3,
        y: shoulder.y + 10
      }, crouchBlend);
      rightElbow = mixPoint({
        x: shoulder.x + facing * 15,
        y: shoulder.y + 3
      }, {
        x: shoulder.x + facing * 14,
        y: shoulder.y + 3
      }, crouchBlend);
    } else if (idling) {
      leftFoot = {
        x: originX - facing * 11,
        y: originY - 1
      };
      rightFoot = {
        x: originX + facing * 12,
        y: originY
      };
      leftKnee = {
        x: originX - facing * 8,
        y: originY - 19 + combatBounce * 0.45
      };
      rightKnee = {
        x: originX + facing * 8,
        y: originY - 21 + combatBounce * 0.35
      };
      leftHand = {
        x: shoulder.x - facing * 17,
        y: shoulder.y + 20 + guardBob
      };
      rightHand = {
        x: shoulder.x + facing * 22,
        y: shoulder.y + 7 - guardBob * 1.35
      };
      leftElbow = {
        x: shoulder.x - facing * 14,
        y: shoulder.y + 9 + guardBob * 0.4
      };
      rightElbow = {
        x: shoulder.x + facing * 15,
        y: shoulder.y + 3 - guardBob * 0.6
      };
    } else {
      const runCycle = Math.sin(player.walkPhase || 0);
      const runLift = Math.max(0, Math.cos(player.walkPhase || 0));
      const rearStride = 7 + runCycle * 18 * speedRatio;
      const frontStride = 7 + runCycle * 18 * speedRatio;
      leftFoot = {
        x: originX - facing * rearStride,
        y: originY - 1 - Math.max(0, -runCycle) * 5 * speedRatio
      };
      rightFoot = {
        x: originX + facing * frontStride,
        y: originY - Math.max(0, runCycle) * 5 * speedRatio
      };
      leftKnee = {
        x: originX - facing * (5 + runCycle * 9 * speedRatio),
        y: originY - 20 - Math.max(0, -runCycle) * 4 * speedRatio
      };
      rightKnee = {
        x: originX + facing * (5 + runCycle * 9 * speedRatio),
        y: originY - 20 - Math.max(0, runCycle) * 4 * speedRatio
      };
      leftHand = {
        x: shoulder.x + facing * (13 + runCycle * 12 * speedRatio),
        y: shoulder.y + 18 - runLift * 3 * speedRatio
      };
      rightHand = {
        x: shoulder.x - facing * (11 + runCycle * 12 * speedRatio),
        y: shoulder.y + 15 + runLift * 3 * speedRatio
      };
      leftElbow = {
        x: shoulder.x + facing * (7 + runCycle * 6 * speedRatio),
        y: shoulder.y + 8
      };
      rightElbow = {
        x: shoulder.x - facing * (7 + runCycle * 6 * speedRatio),
        y: shoulder.y + 7
      };
    }

    const upperArmScale = (
      dashing ||
      sliding ||
      crawling
    ) ? 1.11 : 1.17;
    const forearmScale = (
      dashing ||
      sliding ||
      crawling
    ) ? 1.15 : 1.21;
    const lengthenArm = (elbow, hand) => {
      const originalElbow = { ...elbow };
      const extendedElbow = {
        x: shoulder.x + (elbow.x - shoulder.x) * upperArmScale,
        y: shoulder.y + (elbow.y - shoulder.y) * upperArmScale
      };
      const extendedHand = {
        x: extendedElbow.x +
          (hand.x - originalElbow.x) * forearmScale,
        y: extendedElbow.y +
          (hand.y - originalElbow.y) * forearmScale
      };
      if (player.grounded) {
        extendedHand.y = Math.min(originY, extendedHand.y);
      }
      return {
        elbow: extendedElbow,
        hand: extendedHand
      };
    };
    const leftArm = lengthenArm(leftElbow, leftHand);
    const rightArm = lengthenArm(rightElbow, rightHand);
    leftElbow = leftArm.elbow;
    leftHand = leftArm.hand;
    rightElbow = rightArm.elbow;
    rightHand = rightArm.hand;

    if (!ghost) {
      const heightAboveGround = Math.max(
        0,
        easterEggState.groundY - player.y
      );
      const shadowScale = Math.max(0.34, 1 - heightAboveGround / 260);
      context.save();
      context.fillStyle = `rgb(0 0 0 / ${alpha * 0.34 * shadowScale})`;
      context.beginPath();
      context.ellipse(
        originX,
        easterEggState.groundY + 2,
        (sliding ? 25 : (crawling ? 28 : 18)) * shadowScale,
        3.2 * shadowScale,
        0,
        0,
        Math.PI * 2
      );
      context.fill();
      context.restore();

      if (sliding) {
        const slideEnergy = Math.min(1, Math.abs(player.vx) / 560);
        const entryImpact = player.slideImpact || 0;
        const trailDirection = -slideFacing;
        context.save();
        context.lineCap = "round";
        for (let streak = 0; streak < 5; streak += 1) {
          const height = 3 + streak * 4.5;
          const length = 24 + streak * 8 + slideEnergy * 18;
          context.strokeStyle = streak === 1
            ? `rgb(255 31 45 / ${alpha * (0.18 + entryImpact * 0.34)})`
            : `rgb(194 207 216 / ${alpha * (0.16 + slideEnergy * 0.22)})`;
          context.lineWidth = streak === 1 ? 1.35 : 0.85;
          context.beginPath();
          context.moveTo(
            originX + trailDirection * (12 + streak * 2),
            originY - height
          );
          context.lineTo(
            originX + trailDirection * length,
            originY - height - streak * 0.7
          );
          context.stroke();
        }

        context.strokeStyle = `rgb(205 217 224 / ${alpha * (0.2 + slideEnergy * 0.3)})`;
        context.lineWidth = 0.9;
        for (let dust = 0; dust < 6; dust += 1) {
          const distance = 7 + dust * 7 + entryImpact * dust * 2;
          const rise = 2 + (dust % 3) * 3;
          context.beginPath();
          context.moveTo(
            originX + trailDirection * distance,
            originY
          );
          context.quadraticCurveTo(
            originX + trailDirection * (distance + 4),
            originY - rise - entryImpact * 4,
            originX + trailDirection * (distance + 9),
            originY - 1
          );
          context.stroke();
        }
        context.restore();
      }

      if (crawling) {
        const contactPulse = Math.pow(
          Math.max(0, Math.sin((player.walkPhase || 0) * 2)),
          8
        );
        if (contactPulse > 0.03) {
          context.save();
          context.strokeStyle =
            `rgb(196 208 216 / ${alpha * contactPulse * 0.38})`;
          context.lineWidth = 0.8;
          [-1, 1].forEach((spread) => {
            context.beginPath();
            context.moveTo(
              originX - facing * 12 + spread * 2,
              originY
            );
            context.lineTo(
              originX - facing * 18 + spread * 5,
              originY - 2 - Math.abs(spread)
            );
            context.stroke();
          });
          context.restore();
        }
      }

      const crouchImpact = player.crouchImpact || 0;
      if (crouching && crouchImpact > 0.03) {
        context.save();
        context.strokeStyle =
          `rgb(213 224 230 / ${alpha * crouchImpact * 0.45})`;
        context.lineWidth = 0.9;
        [-1, 1].forEach((side) => {
          context.beginPath();
          context.moveTo(originX + side * 14, originY - 22);
          context.lineTo(
            originX + side * (18 + crouchImpact * 4),
            originY - 12
          );
          context.lineTo(originX + side * 14, originY - 5);
          context.stroke();
        });
        context.restore();
      }

      const stepImpact = (
        player.grounded &&
        !sliding &&
        !crawling &&
        !crouching &&
        speedRatio > 0.42
      )
        ? Math.pow(
          Math.max(0, Math.sin((player.walkPhase || 0) * 2)),
          12
        ) * speedRatio
        : 0;
      if (stepImpact > 0.06) {
        const stepSide = Math.sin(player.walkPhase || 0) > 0 ? 1 : -1;
        const footX = originX + stepSide * 9;
        context.save();
        context.strokeStyle = `rgb(184 198 207 / ${stepImpact * alpha * 0.45})`;
        context.lineWidth = 0.9;
        [-1, 1].forEach((direction) => {
          context.beginPath();
          context.moveTo(footX + direction * 3, originY);
          context.lineTo(
            footX + direction * (8 + stepImpact * 5),
            originY - 2 - stepImpact * 3
          );
          context.stroke();
        });
        context.restore();
      }

      const turnImpact = player.turnImpact || 0;
      if (turnImpact > 0.02) {
        const trailDirection = -facing;
        context.save();
        context.strokeStyle = `rgb(212 224 231 / ${turnImpact * alpha * 0.56})`;
        context.lineWidth = 1;
        for (let streak = 0; streak < 4; streak += 1) {
          const spread = (streak - 1.5) * 3.2;
          context.beginPath();
          context.moveTo(
            originX + trailDirection * (7 + streak * 2),
            originY - 1 - Math.abs(spread) * 0.25
          );
          context.lineTo(
            originX + trailDirection * (21 + streak * 5) +
              spread * 0.35,
            originY - 5 - spread
          );
          context.stroke();
        }
        context.restore();
      }

      const impactStrength = Math.min(1, player.landingSquash / 7);
      if (impactStrength > 0.02) {
        context.save();
        context.strokeStyle = `rgb(218 229 235 / ${impactStrength * alpha * 0.5})`;
        context.lineWidth = 1.1;
        [-1, 1].forEach((direction) => {
          context.beginPath();
          context.moveTo(originX + direction * 10, originY + 1);
          context.quadraticCurveTo(
            originX + direction * 25,
            originY - impactStrength * 6,
            originX + direction * (32 + impactStrength * 10),
            originY + 1
          );
          context.stroke();
          context.beginPath();
          context.moveTo(originX + direction * 16, originY);
          context.lineTo(
            originX + direction * (21 + impactStrength * 6),
            originY - 5 - impactStrength * 4
          );
          context.stroke();
        });
        context.restore();
      }

      if (dashing) {
        const dashBurst = Math.max(
          0,
          Math.min(
            1,
            (player.dashTime - DASH_DURATION_SECONDS * 0.62) /
              (DASH_DURATION_SECONDS * 0.38)
          )
        );
        if (dashBurst > 0) {
          const burstX = originX - player.dashDirectionX * 12;
          const burstY = originY - 38 - player.dashDirectionY * 12;
          context.save();
          context.strokeStyle = `rgb(255 31 45 / ${dashBurst * alpha * 0.72})`;
          context.lineWidth = 1.35;
          for (let ray = 0; ray < 7; ray += 1) {
            const angle = ray / 7 * Math.PI * 2;
            const inner = 11 + (ray % 2) * 3;
            const outer = inner + 9 + dashBurst * 8;
            context.beginPath();
            context.moveTo(
              burstX + Math.cos(angle) * inner,
              burstY + Math.sin(angle) * inner
            );
            context.lineTo(
              burstX + Math.cos(angle) * outer,
              burstY + Math.sin(angle) * outer
            );
            context.stroke();
          }
          context.restore();
        }
      }
    }

    const animationTime = player.animationTime || 0;
    const dashProgress = dashing
      ? Math.max(
        0,
        Math.min(1, 1 - player.dashTime / DASH_DURATION_SECONDS)
      )
      : 0;
    const dashWhip = dashing
      ? Math.sin(dashProgress * Math.PI) *
        (0.72 + Math.abs(Math.sin(dashProgress * Math.PI * 2)) * 0.28)
      : 0;
    const airborne = !player.grounded && !dashing;
    const verticalCapeLag = sliding
      ? 0
      : (
        dashing
          ? -player.dashDirectionY * (16 + dashWhip * 8)
          : (
            airborne
              ? Math.max(-24, Math.min(24, -player.vy / 30))
              : 0
          )
      );
    const tailDrift = sliding
      ? -player.slideDirection * 12
      : (dashing
        ? -player.dashDirectionX * (16 + dashWhip * 8)
        : -Math.max(-8, Math.min(8, player.vx / 48)));
    const travelDirection = Math.abs(player.vx) > 20
      ? Math.sign(player.vx)
      : facing;
    const motionDirection = sliding
      ? (player.slideDirection || facing)
      : (dashing ? (player.dashDirectionX || facing) : travelDirection);
    const capeBack = -motionDirection;
    const capeReach = sliding
      ? 48
      : (
        dashing
          ? 58 + dashWhip * 13
          : (
            crawling
              ? 25
              : (
                airborne
                  ? 42 + speedRatio * 15 +
                    Math.min(8, Math.abs(player.vy) / 90)
                  : 36 + speedRatio * 16
              )
          )
      );
    const capeDrop = dashing
      ? 23 + verticalCapeLag
      : (
        sliding
          ? 26
          : (
            crawling
              ? 11
              : (airborne ? 34 + verticalCapeLag : 48)
          )
      );
    const capeFlutter = sliding
      ? Math.sin(
        (player.walkPhase || 0) * 1.35 + idleTime * 1.3
      ) * (1.4 + speedRatio * 2.2)
      : Math.sin(
        animationTime * (dashing ? 18 : (airborne ? 8.5 : 2.4)) +
          dashProgress * Math.PI * 3
      ) * (
        dashing
          ? 4 + dashWhip * 5
          : (airborne ? 2.8 + speedRatio * 3 : 1.4 + speedRatio * 2.2)
      );
    const capeSecondaryWave = sliding
      ? capeFlutter * 0.8
      : Math.sin(
        animationTime * (dashing ? 23 : (airborne ? 11 : 3.1)) + 1.7
      ) * (
        dashing
          ? 3.5 + dashWhip * 4
          : (airborne ? 2.2 + speedRatio * 2.4 : 1.1)
      );
    drawPolygon(context, [
      {
        x: shoulder.x - facing * 10,
        y: shoulder.y - 2
      },
      {
        x: shoulder.x + facing * 4,
        y: shoulder.y + 4
      },
      {
        x: hip.x + capeBack * 2,
        y: hip.y + 5
      },
      {
        x: hip.x + capeBack * 10,
        y: hip.y + 24 + capeFlutter * 0.35 +
          (sliding ? 0 : verticalCapeLag * 0.35)
      },
      {
        x: shoulder.x + capeBack * capeReach * 0.62,
        y: shoulder.y + capeDrop + capeFlutter
      },
      {
        x: shoulder.x + capeBack * capeReach * 0.78,
        y: shoulder.y + capeDrop - 8 + capeSecondaryWave
      },
      {
        x: shoulder.x + capeBack * capeReach,
        y: shoulder.y + capeDrop - 20 + capeFlutter * 0.55 -
          capeSecondaryWave * 0.35
      },
      {
        x: shoulder.x + capeBack * capeReach * 0.72,
        y: shoulder.y + 11
      }
    ], capeFill, capeStroke, bodyLineWidth * 0.95);

    if (ghost) {
      drawLimbPolygon(
        context,
        hip,
        leftKnee,
        6,
        4.5,
        fill,
        stroke,
        bodyLineWidth
      );
      drawLimbPolygon(
        context,
        leftKnee,
        leftFoot,
        4.5,
        3.4,
        fill,
        stroke,
        bodyLineWidth
      );
      drawLimbPolygon(
        context,
        hip,
        rightKnee,
        6,
        4.5,
        fill,
        stroke,
        bodyLineWidth
      );
      drawLimbPolygon(
        context,
        rightKnee,
        rightFoot,
        4.5,
        3.4,
        fill,
        stroke,
        bodyLineWidth
      );
      drawPolygon(context, [
        { x: shoulder.x - 16, y: shoulder.y },
        { x: shoulder.x + 16, y: shoulder.y },
        { x: hip.x + 8, y: hip.y + 5 },
        { x: hip.x - 8, y: hip.y + 5 }
      ], fill, stroke, bodyLineWidth);
      drawPolygon(context, [
        { x: headCenter.x - 10, y: headCenter.y - 7 },
        { x: headCenter.x - facing * 7, y: headCenter.y - 14 },
        { x: headCenter.x + facing * 11, y: headCenter.y - 6 },
        { x: headCenter.x + 8, y: headCenter.y + 8 },
        { x: headCenter.x - 7, y: headCenter.y + 8 }
      ], fill, stroke, bodyLineWidth);
      context.restore();
      return;
    }

    drawPolygon(context, [
      { x: hip.x - 7, y: hip.y - 3 },
      { x: hip.x - 1, y: hip.y - 1 },
      { x: hip.x - 2 + tailDrift, y: hip.y + 19 },
      { x: hip.x - 10 + tailDrift * 0.55, y: hip.y + 13 }
    ], rearFill, jointStroke, bodyLineWidth * 0.82);
    drawPolygon(context, [
      { x: hip.x + 1, y: hip.y - 1 },
      { x: hip.x + 7, y: hip.y - 3 },
      { x: hip.x + 10 + tailDrift * 0.55, y: hip.y + 13 },
      { x: hip.x + 2 + tailDrift, y: hip.y + 19 }
    ], rearFill, jointStroke, bodyLineWidth * 0.82);

    drawLimbPolygon(
      context,
      hip,
      leftKnee,
      5.5,
      4.1,
      rearFill,
      jointStroke,
      bodyLineWidth
    );
    drawLimbPolygon(
      context,
      leftKnee,
      leftFoot,
      4.1,
      3.1,
      rearFill,
      jointStroke,
      bodyLineWidth
    );
    drawArmouredBoot(
      context,
      leftFoot,
      Math.sign(leftFoot.x - leftKnee.x) || facing,
      rearFill,
      jointStroke,
      bodyLineWidth
    );

    drawLimbPolygon(
      context,
      shoulder,
      leftElbow,
      4.5,
      3.4,
      rearFill,
      jointStroke,
      bodyLineWidth
    );
    drawLimbPolygon(
      context,
      leftElbow,
      leftHand,
      3.6,
      2.55,
      rearFill,
      jointStroke,
      bodyLineWidth
    );
    drawArmouredGauntlet(
      context,
      leftHand,
      leftElbow,
      rearFill,
      jointStroke,
      bodyLineWidth
    );

    drawLimbPolygon(
      context,
      hip,
      rightKnee,
      5.8,
      4.3,
      fill,
      stroke,
      bodyLineWidth
    );
    drawLimbPolygon(
      context,
      rightKnee,
      rightFoot,
      4.3,
      3.2,
      fill,
      stroke,
      bodyLineWidth
    );
    drawArmouredBoot(
      context,
      rightFoot,
      Math.sign(rightFoot.x - rightKnee.x) || facing,
      fill,
      stroke,
      bodyLineWidth
    );

    drawPolygon(context, [
      { x: shoulder.x - 13.5, y: shoulder.y - 2 },
      { x: shoulder.x - 18.5, y: shoulder.y + 5 },
      { x: shoulder.x - 11.5, y: shoulder.y + 11 },
      { x: hip.x - 7.5, y: hip.y + 2 },
      { x: hip.x, y: hip.y + 5 },
      { x: hip.x + 7.5, y: hip.y + 2 },
      { x: shoulder.x + 11.5, y: shoulder.y + 11 },
      { x: shoulder.x + 18.5, y: shoulder.y + 5 },
      { x: shoulder.x + 13.5, y: shoulder.y - 2 }
    ], fill, brightStroke, bodyLineWidth * 1.08);

    drawPolygon(context, [
      { x: shoulder.x - 19, y: shoulder.y + 3 },
      { x: shoulder.x - 9, y: shoulder.y - 2 },
      { x: shoulder.x - 6, y: shoulder.y + 7 },
      { x: shoulder.x - 15, y: shoulder.y + 12 }
    ], insetFill, stroke, bodyLineWidth);
    drawPolygon(context, [
      { x: shoulder.x + 9, y: shoulder.y - 2 },
      { x: shoulder.x + 19, y: shoulder.y + 3 },
      { x: shoulder.x + 15, y: shoulder.y + 12 },
      { x: shoulder.x + 6, y: shoulder.y + 7 }
    ], insetFill, stroke, bodyLineWidth);

    drawPolygon(context, [
      { x: hip.x - 8.5, y: hip.y - 2 },
      { x: hip.x + 8.5, y: hip.y - 2 },
      { x: hip.x + 6, y: hip.y + 6 },
      { x: hip.x, y: hip.y + 9 },
      { x: hip.x - 6, y: hip.y + 6 }
    ], insetFill, stroke, bodyLineWidth);

    drawLimbPolygon(
      context,
      shoulder,
      rightElbow,
      4.8,
      3.55,
      fill,
      stroke,
      bodyLineWidth
    );
    drawLimbPolygon(
      context,
      rightElbow,
      rightHand,
      3.7,
      2.6,
      fill,
      stroke,
      bodyLineWidth
    );
    drawArmouredGauntlet(
      context,
      rightHand,
      rightElbow,
      fill,
      stroke,
      bodyLineWidth
    );

    drawPolygon(context, [
      { x: neck.x - 6, y: neck.y + 4 },
      { x: neck.x - 3, y: neck.y - 3 },
      { x: neck.x + 3, y: neck.y - 3 },
      { x: neck.x + 6, y: neck.y + 4 },
      { x: shoulder.x, y: shoulder.y + 3 }
    ], insetFill, stroke, bodyLineWidth);

    drawPolygon(context, [
      { x: headCenter.x - 5.5, y: headCenter.y - 11 },
      { x: headCenter.x + 5.5, y: headCenter.y - 11 },
      { x: headCenter.x + 9.5, y: headCenter.y - 5 },
      { x: headCenter.x + 8.5, y: headCenter.y + 6 },
      { x: headCenter.x + 3.5, y: headCenter.y + 10 },
      { x: headCenter.x - 4.5, y: headCenter.y + 9 },
      { x: headCenter.x - 9, y: headCenter.y + 4 },
      { x: headCenter.x - 9.5, y: headCenter.y - 5 }
    ], fill, brightStroke, bodyLineWidth * 1.08);

    drawPolygon(context, [
      {
        x: headCenter.x - facing * 2,
        y: headCenter.y - 11
      },
      {
        x: headCenter.x - facing * 20,
        y: headCenter.y - 15
      },
      {
        x: headCenter.x - facing * 13,
        y: headCenter.y - 7
      },
      {
        x: headCenter.x + facing * 4,
        y: headCenter.y - 6
      }
    ], insetFill, brightStroke, bodyLineWidth);
    drawPolygon(context, [
      {
        x: headCenter.x + facing * 3,
        y: headCenter.y - 8
      },
      {
        x: headCenter.x + facing * 13,
        y: headCenter.y - 5
      },
      {
        x: headCenter.x + facing * 15,
        y: headCenter.y + 1
      },
      {
        x: headCenter.x + facing * 7,
        y: headCenter.y + 4
      },
      {
        x: headCenter.x + facing * 2,
        y: headCenter.y
      }
    ], insetFill, brightStroke, bodyLineWidth);

    if (!ghost) {
      context.save();
      context.strokeStyle = accent;
      context.lineWidth = 1.6;
      context.shadowColor = accent;
      context.shadowBlur = 4;
      context.beginPath();
      context.moveTo(
        headCenter.x - facing * 3,
        headCenter.y - 1
      );
      context.lineTo(
        headCenter.x + facing * 11,
        headCenter.y
      );
      context.stroke();
      context.restore();

      drawPolygon(context, [
        { x: shoulder.x - 1.8, y: shoulder.y + 4 },
        { x: shoulder.x + 1.8, y: shoulder.y + 4 },
        { x: hip.x + 2.8, y: hip.y - 1 },
        { x: hip.x, y: hip.y + 5 },
        { x: hip.x - 2.8, y: hip.y - 1 }
      ], `rgb(116 17 26 / ${alpha * 0.82})`, accent, 0.8);

      context.save();
      context.strokeStyle = `rgb(134 148 159 / ${alpha * 0.72})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(shoulder.x - 7, shoulder.y + 6);
      context.lineTo(shoulder.x, hip.y - 6);
      context.lineTo(shoulder.x + 7, shoulder.y + 6);
      context.moveTo(shoulder.x, shoulder.y + 4);
      context.lineTo(hip.x, hip.y + 2);
      context.stroke();
      context.restore();

      drawJointDiamond(
        context,
        {
          x: shoulder.x,
          y: shoulder.y + 13
        },
        2.5,
        jointFill,
        jointStroke,
        0.9
      );

      [
        [leftKnee, 2.45],
        [rightKnee, 2.55],
        [leftElbow, 2.25],
        [rightElbow, 2.35]
      ].forEach(([point, size]) => {
        drawJointDiamond(
          context,
          point,
          size,
          jointFill,
          jointStroke,
          0.85
        );
      });
    }
    context.restore();
  }

  function getEasterEggPlatformBounds(width, progress = 1) {
    const easedProgress = easeOutCubic(progress);
    const totalWidth = Math.min(width - 76, 1120);
    const halfWidth = totalWidth * 0.5 * easedProgress;
    const centerX = width / 2;
    return {
      left: centerX - halfWidth,
      right: centerX + halfWidth
    };
  }

  function drawEasterEggGround(context, width, groundY, progress) {
    const easedProgress = easeOutCubic(progress);
    const { left, right } = getEasterEggPlatformBounds(width, progress);

    context.save();
    context.strokeStyle = "rgb(133 143 153 / 72%)";
    context.lineWidth = 1.25;
    context.beginPath();
    context.moveTo(left, groundY);
    context.lineTo(right, groundY);
    context.stroke();

    if (easedProgress > 0.92) {
      const terminalAlpha = Math.min(1, (easedProgress - 0.92) / 0.08);
      context.strokeStyle = `rgb(181 192 201 / ${terminalAlpha * 0.74})`;
      context.lineWidth = 1;

      [left, right].forEach((x, index) => {
        const direction = index === 0 ? -1 : 1;
        context.save();
        context.translate(x, groundY);
        context.rotate(Math.PI / 4);
        context.strokeRect(-4, -4, 8, 8);
        context.restore();

        context.beginPath();
        context.moveTo(x + direction * 8, groundY);
        context.lineTo(x + direction * 18, groundY);
        context.lineTo(x + direction * 24, groundY - direction * 5);
        context.stroke();
      });
    }

    context.restore();
  }

  function getEasterEggInputDirection() {
    const dashModifierHeld = easterEggState.keys.has("shift");
    const x = (
      (easterEggState.keys.has("d") ? 1 : 0) -
      (easterEggState.keys.has("a") ? 1 : 0)
    );
    const y = (
      (easterEggState.keys.has("s") ? 1 : 0) -
      (
        easterEggState.keys.has("w") ||
        (dashModifierHeld && easterEggState.keys.has("space"))
          ? 1
          : 0
      )
    );
    const distance = Math.hypot(x, y);

    if (!distance) {
      return { x: 0, y: 0 };
    }

    return {
      x: x / distance,
      y: y / distance
    };
  }

  function normalizeEasterEggControlKey(value) {
    const key = value.toLowerCase();
    const aliases = {
      arrowup: "w",
      arrowleft: "a",
      arrowdown: "s",
      arrowright: "d",
      " ": "space",
      spacebar: "space",
      k: "shift"
    };
    return aliases[key] || key;
  }

  function moveToward(value, target, maximumDelta) {
    if (value < target) {
      return Math.min(value + maximumDelta, target);
    }
    return Math.max(value - maximumDelta, target);
  }

  function performEasterEggJump() {
    const player = easterEggState.player;
    if (
      !easterEggState.live ||
      (!player.grounded && player.coyoteTimer <= 0)
    ) {
      return false;
    }

    const carriedSlideSpeed = player.slideTime > 0
      ? Math.max(400, Math.abs(player.vx) * 0.96)
      : 0;

    if (carriedSlideSpeed) {
      player.vx = (
        player.slideDirection ||
        Math.sign(player.vx) ||
        player.facing
      ) * carriedSlideSpeed;
    }

    player.slideTime = 0;
    player.dashTime = 0;
    player.vy = -JUMP_SPEED;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.landingSquash = 0;
    player.takeoffStretch = 1;
    return true;
  }

  function queueEasterEggJump() {
    easterEggState.player.jumpBufferTimer = JUMP_BUFFER_SECONDS;
    if (performEasterEggJump()) {
      playJumpSound();
    }
  }

  function startEasterEggDash(
    allowBuffer = true,
    useFacingWhenNeutral = false
  ) {
    const player = easterEggState.player;
    if (
      !easterEggState.live ||
      player.dashCooldown > 0 ||
      player.dashTime > 0 ||
      player.slideTime > 0
    ) {
      if (allowBuffer && easterEggState.live) {
        player.dashBufferTimer = DASH_BUFFER_SECONDS;
      }
      return;
    }

    let direction = getEasterEggInputDirection();
    if (!direction.x && !direction.y) {
      if (useFacingWhenNeutral) {
        direction = { x: player.facing || 1, y: 0 };
      } else {
        if (allowBuffer) {
          player.dashBufferTimer = DASH_BUFFER_SECONDS;
        }
        return;
      }
    }

    if (
      player.grounded &&
      direction.y > 0.35
    ) {
      player.slideDirection = Math.sign(direction.x) || player.facing || 1;
      player.facing = player.slideDirection;
      player.vx = player.slideDirection * Math.min(
        690,
        Math.max(560, Math.abs(player.vx) + 95)
      );
      player.vy = 0;
      player.slideTime = SLIDE_DURATION_SECONDS;
      player.slideImpact = 1;
      player.crouchImpact = 0;
      player.dashCooldown = DASH_COOLDOWN_SECONDS;
      player.dashDirectionX = player.slideDirection;
      player.dashDirectionY = 0;
      soundState.dashAvailable = false;
      player.dashBufferTimer = 0;
      playSlideSound(player.slideDirection);
      return;
    }

    const startedGrounded = player.grounded;
    if (!startedGrounded) {
      if (player.airDashUsed) {
        return;
      }
      player.airDashUsed = true;
    }

    const groundedDash = startedGrounded && Math.abs(direction.y) < 0.35;
    player.dashDirectionX = direction.x;
    player.dashDirectionY = groundedDash ? 0 : direction.y;
    const dashSpeed = Math.min(
      980,
      Math.max(850, Math.hypot(player.vx, player.vy) + 135)
    );
    player.vx = direction.x * dashSpeed;
    player.vy = groundedDash ? 0 : direction.y * dashSpeed;
    player.dashTime = DASH_DURATION_SECONDS;
    player.dashCooldown = DASH_COOLDOWN_SECONDS;
    player.dashBufferTimer = 0;
    player.grounded = groundedDash;
    soundState.dashAvailable = false;
    playDashSound(direction, !groundedDash);

    if (direction.x) {
      player.facing = Math.sign(direction.x);
    }
  }

  function updateEasterEggDashStatus() {
    const player = easterEggState.player;
    const cooling = player.dashCooldown > 0.005;
    const airSpent = (
      !player.grounded &&
      player.airDashUsed &&
      !cooling
    );
    const charge = airSpent
      ? 0
      : Math.max(
        0,
        Math.min(1, 1 - player.dashCooldown / DASH_COOLDOWN_SECONDS)
      );
    let label = "Ready";
    const dashAvailable = !cooling && !airSpent;

    if (cooling) {
      label = `${player.dashCooldown.toFixed(1)}s`;
    } else if (airSpent) {
      label = "Air spent";
    }

    easterEggDashStatus.style.setProperty("--dash-charge", charge.toFixed(3));
    easterEggDashStatus.classList.toggle("is-cooling", cooling);
    easterEggDashStatus.classList.toggle("is-air-spent", airSpent);
    if (dashStatusLabel.textContent !== label) {
      dashStatusLabel.textContent = label;
    }
    if (
      easterEggState.live &&
      dashAvailable &&
      !soundState.dashAvailable
    ) {
      playDashReadySound();
    }
    soundState.dashAvailable = dashAvailable;

    let motion = "idle";
    if (player.slideTime > 0) {
      motion = "slide";
    } else if (player.dashTime > 0) {
      motion = "dash";
    } else if (!player.grounded) {
      motion = "airborne";
    } else if (
      easterEggState.keys.has("s") &&
      (
        easterEggState.keys.has("a") ||
        easterEggState.keys.has("d")
      )
    ) {
      motion = "crawl";
    } else if (
      easterEggState.keys.has("s") &&
      !easterEggState.keys.has("a") &&
      !easterEggState.keys.has("d")
    ) {
      motion = "crouch";
    } else if (Math.abs(player.vx) > 12) {
      motion = "run";
    }
    easterEggStage.dataset.motion = motion;
  }

  function respawnEasterEggPlayer(width) {
    const player = easterEggState.player;
    player.x = width * 0.5;
    player.y = easterEggState.groundY;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.grounded = true;
    player.walkPhase = 0;
    player.idlePhase = 0;
    player.dashTime = 0;
    player.slideTime = 0;
    player.slideDirection = 0;
    player.dashCooldown = 0;
    player.airDashUsed = false;
    player.dashBufferTimer = 0;
    player.jumpBufferTimer = 0;
    player.coyoteTimer = COYOTE_TIME_SECONDS;
    player.crouchBlend = 0;
    player.crawlBlend = 0;
    player.landingSquash = 3;
    player.trail = [];
    soundState.dashAvailable = true;
  }

  function updateEasterEggPlayer(deltaTime) {
    const player = easterEggState.player;
    const canvasRect = easterEggCanvas.getBoundingClientRect();
    const platformBounds = getEasterEggPlatformBounds(canvasRect.width);
    const bossPlatforms = bossEncounter?.active
      ? bossEncounter.getPlatforms()
      : [];
    const collisionPlatforms = [
      {
        id: "ground",
        x: platformBounds.left,
        y: easterEggState.groundY,
        width: platformBounds.right - platformBounds.left
      },
      ...bossPlatforms
    ];
    const minimumY = Math.max(150, canvasRect.height * 0.19);
    const wasGrounded = player.grounded;
    const previousFootY = player.y;

    if (player.respawnTimer > 0) {
      player.respawnTimer = Math.max(0, player.respawnTimer - deltaTime);
      if (player.respawnTimer === 0) {
        respawnEasterEggPlayer(canvasRect.width);
        updateEasterEggDashStatus();
      } else {
        easterEggStage.dataset.motion = "fallen";
      }
      return;
    }

    player.dashCooldown = Math.max(0, player.dashCooldown - deltaTime);
    player.animationTime = (player.animationTime || 0) + deltaTime;
    player.jumpBufferTimer = Math.max(
      0,
      player.jumpBufferTimer - deltaTime
    );
    player.dashBufferTimer = Math.max(
      0,
      player.dashBufferTimer - deltaTime
    );
    player.landingSquash = Math.max(
      0,
      player.landingSquash - deltaTime * 42
    );
    player.turnImpact = Math.max(0, player.turnImpact - deltaTime * 7.5);
    player.takeoffStretch = Math.max(
      0,
      player.takeoffStretch - deltaTime * 6.8
    );
    player.crouchImpact = Math.max(
      0,
      (player.crouchImpact || 0) - deltaTime * 4.8
    );
    player.slideImpact = Math.max(
      0,
      (player.slideImpact || 0) - deltaTime * 3.6
    );
    const lowStanceRequested = (
      player.grounded &&
      easterEggState.keys.has("s") &&
      player.dashTime <= 0 &&
      player.slideTime <= 0
    );
    const crawlRequested = (
      lowStanceRequested &&
      (
        easterEggState.keys.has("a") ||
        easterEggState.keys.has("d")
      )
    );
    player.crouchBlend = moveToward(
      player.crouchBlend || 0,
      lowStanceRequested ? 1 : 0,
      deltaTime * (lowStanceRequested ? 7.5 : 9)
    );
    player.crawlBlend = moveToward(
      player.crawlBlend || 0,
      crawlRequested ? 1 : 0,
      deltaTime * (crawlRequested ? 5.8 : 8.5)
    );
    if (player.grounded) {
      player.coyoteTimer = COYOTE_TIME_SECONDS;
    } else {
      player.coyoteTimer = Math.max(0, player.coyoteTimer - deltaTime);
    }
    player.trail = player.trail
      .map((trailPoint) => ({
        ...trailPoint,
        age: trailPoint.age + deltaTime
      }))
      .filter((trailPoint) => trailPoint.age < 0.24);

    if (player.slideTime > 0) {
      player.slideTime = Math.max(0, player.slideTime - deltaTime);
      player.vx = moveToward(player.vx, 0, 620 * deltaTime);
      player.x += player.vx * deltaTime;
      const slidePlatform = collisionPlatforms.find((platform) => (
        player.x >= platform.x &&
        player.x <= platform.x + platform.width &&
        Math.abs(player.y - platform.y) <= 7
      ));
      if (slidePlatform) {
        player.y = slidePlatform.y;
        player.vy = 0;
        player.grounded = true;
      } else {
        player.slideTime = 0;
        player.grounded = false;
        player.vy = Math.max(90, player.vy);
      }
      player.trail.push({
        x: player.x,
        y: player.y,
        age: 0,
        vx: player.vx,
        facing: player.facing,
        dashTime: 0,
        slideTime: player.slideTime,
        slideDirection: player.slideDirection,
        dashDirectionX: player.slideDirection,
        dashDirectionY: 0,
        grounded: true,
        walkPhase: player.walkPhase
      });

      if (player.slideTime === 0) {
        player.vx *= 0.88;
      }
    } else if (player.dashTime > 0) {
      player.dashTime = Math.max(0, player.dashTime - deltaTime);
      let dashCancelled = false;
      const dashExitInput = (
        (easterEggState.keys.has("d") ? 1 : 0) -
        (easterEggState.keys.has("a") ? 1 : 0)
      );
      if (
        player.grounded &&
        player.dashTime <= 0.038 &&
        dashExitInput &&
        Math.sign(player.dashDirectionX) !== dashExitInput
      ) {
        player.dashTime = 0;
        player.vx = dashExitInput * RUN_SPEED * 0.72;
        player.facing = dashExitInput;
        player.turnImpact = 1;
        dashCancelled = true;
      }
      player.x += player.vx * deltaTime;
      player.y += player.vy * deltaTime;
      player.trail.push({
        x: player.x,
        y: player.y,
        age: 0,
        vx: player.vx,
        facing: player.facing,
        dashTime: player.dashTime,
        slideTime: 0,
        slideDirection: 0,
        dashDirectionX: player.dashDirectionX,
        dashDirectionY: player.dashDirectionY,
        grounded: player.grounded,
        walkPhase: player.walkPhase
      });

      if (player.dashTime === 0 && !dashCancelled) {
        player.vx *= player.grounded ? 0.46 : 0.62;
        player.vy *= player.grounded ? 0 : 0.34;
      }
    } else {
      const horizontalInput = (
        (easterEggState.keys.has("d") ? 1 : 0) -
        (easterEggState.keys.has("a") ? 1 : 0)
      );
      const crawling = (
        player.grounded &&
        easterEggState.keys.has("s") &&
        horizontalInput !== 0
      );
      const targetSpeed = crawling ? CRAWL_SPEED : RUN_SPEED;
      if (horizontalInput) {
        const reversing = (
          Math.abs(player.vx) > 20 &&
          Math.sign(player.vx) !== horizontalInput
        );
        if (reversing && player.grounded && player.turnImpact < 0.08) {
          player.turnImpact = 1;
        }
        const accelerating = Math.abs(player.vx) < targetSpeed;
        const acceleration = reversing
          ? TURN_ACCELERATION
          : (
            crawling
              ? CRAWL_ACCELERATION
              : (player.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION)
          );

        if (accelerating || reversing) {
          player.vx = moveToward(
            player.vx,
            horizontalInput * targetSpeed,
            acceleration * deltaTime
          );
        } else if (Math.sign(player.vx) === horizontalInput) {
          player.vx = moveToward(
            player.vx,
            horizontalInput * targetSpeed,
            OVERSPEED_DRAG * deltaTime
          );
        }
        player.facing = Math.sign(horizontalInput);
      } else {
        player.vx = moveToward(
          player.vx,
          0,
          (player.grounded ? GROUND_FRICTION : AIR_DRAG) * deltaTime
        );
      }

      if (easterEggState.keys.has("s") && !player.grounded) {
        player.vy += 1050 * deltaTime;
      }

      let gravityMultiplier = 1;
      if (player.vy < -90) {
        gravityMultiplier = (
          easterEggState.keys.has("w") ||
          easterEggState.keys.has("space")
        ) ? 0.74 : 1.62;
      } else if (Math.abs(player.vy) <= 90) {
        gravityMultiplier = 0.78;
      } else if (player.vy > 90) {
        gravityMultiplier = 1.4;
      }
      player.vy = Math.min(
        1120,
        player.vy + 1850 * gravityMultiplier * deltaTime
      );
      player.x += player.vx * deltaTime;
      player.y += player.vy * deltaTime;
    }

    const crossedPlatforms = collisionPlatforms
      .filter((platform) => (
        player.x >= platform.x &&
        player.x <= platform.x + platform.width &&
        previousFootY <= platform.y + 2 &&
        player.y >= platform.y &&
        player.vy >= 0
      ))
      .sort((first, second) => first.y - second.y);
    const landingPlatform = crossedPlatforms[0] || null;
    const platformSupported = Boolean(landingPlatform);
    easterEggStage.dataset.platformSupported = String(platformSupported);
    if (landingPlatform) {
      const landingVelocity = player.vy;
      player.y = landingPlatform.y;
      player.vy = 0;
      player.grounded = true;
      if (!wasGrounded) {
        player.airDashUsed = false;
        player.landingSquash = Math.min(
          9,
          Math.max(0, (landingVelocity - 300) / 62)
        );
        playLandingSound(landingVelocity);
      }
      player.coyoteTimer = COYOTE_TIME_SECONDS;
      if (player.jumpBufferTimer > 0 && player.dashTime <= 0) {
        if (performEasterEggJump()) {
          playJumpSound();
        }
      }
    } else {
      player.grounded = false;
    }

    if (player.y < minimumY) {
      player.y = minimumY;
      if (player.vy < 0) {
        player.vy = 0;
      }
    }

    if (player.y > canvasRect.height + 64) {
      player.respawnTimer = 0.78;
      player.grounded = false;
      player.dashTime = 0;
      player.slideTime = 0;
      player.trail = [];
      easterEggState.keys.clear();
      if (bossEncounter?.active) {
        bossEncounter.playerFell(getBossFightWorld(canvasRect));
      } else {
        playFallDeathSound();
      }
      updateEasterEggDashStatus();
      easterEggStage.dataset.motion = "fallen";
      return;
    }

    if (player.grounded) {
      const crawlCycle = (
        easterEggState.keys.has("s") &&
        Math.abs(player.vx) > 8
      );
      player.walkPhase += Math.abs(player.vx) * deltaTime *
        (crawlCycle ? 0.07 : 0.035);
    }
    if (
      player.grounded &&
      Math.abs(player.vx) < 12 &&
      player.dashTime <= 0 &&
      player.slideTime <= 0
    ) {
      player.idlePhase += deltaTime;
    } else {
      player.idlePhase = 0;
    }

    if (
      player.dashBufferTimer > 0 &&
      player.dashCooldown <= 0 &&
      player.dashTime <= 0 &&
      player.slideTime <= 0
    ) {
      startEasterEggDash(false);
    }

    updateEasterEggDashStatus();
  }

  function drawEasterEggFrame(now) {
    if (!easterEggState.active) {
      return;
    }

    const rect = easterEggCanvas.getBoundingClientRect();
    const elapsed = now - easterEggState.sceneStartedAt;
    const groundProgress = (elapsed - 720) / 1450;
    const characterProgress = easeOutCubic((elapsed - 2180) / 620);
    const deltaTime = easterEggState.lastFrameAt
      ? Math.min(0.032, (now - easterEggState.lastFrameAt) / 1000)
      : 0;
    easterEggState.lastFrameAt = now;

    easterEggContext.clearRect(0, 0, rect.width, rect.height);
    drawEasterEggGround(
      easterEggContext,
      rect.width,
      easterEggState.groundY,
      groundProgress
    );

    let bossWorld = null;
    if (easterEggState.live) {
      updateEasterEggPlayer(deltaTime);
      bossWorld = getBossFightWorld(rect);
      bossEncounter?.update(deltaTime, bossWorld);
      bossEncounter?.drawBack(easterEggContext, bossWorld);
    }

    if (characterProgress > 0) {
      easterEggState.player.trail.forEach((trailPoint) => {
        if (trailPoint.slideTime > 0) {
          return;
        }
        const trailAlpha = (
          1 - trailPoint.age / 0.24
        ) * 0.19 * characterProgress;
        drawPolygonCharacter(
          easterEggContext,
          trailPoint,
          trailAlpha,
          true
        );
      });

      if (easterEggState.player.dashTime > 0) {
        const player = easterEggState.player;
        easterEggContext.save();
        easterEggContext.strokeStyle = "rgb(255 31 45 / 42%)";
        easterEggContext.lineWidth = 1.15;
        for (let index = 0; index < 4; index += 1) {
          const offset = 24 + index * 12;
          const spread = (index - 1.5) * 5;
          easterEggContext.beginPath();
          easterEggContext.moveTo(
            player.x - player.dashDirectionX * offset -
              player.dashDirectionY * spread,
            player.y - 34 - player.dashDirectionY * offset +
              player.dashDirectionX * spread
          );
          easterEggContext.lineTo(
            player.x - player.dashDirectionX * (offset + 22) -
              player.dashDirectionY * spread,
            player.y - 34 - player.dashDirectionY * (offset + 22) +
              player.dashDirectionX * spread
          );
          easterEggContext.stroke();
        }
        easterEggContext.restore();
      }

      if (easterEggState.player.slideTime > 0) {
        const player = easterEggState.player;
        easterEggContext.save();
        easterEggContext.strokeStyle = "rgb(255 143 38 / 48%)";
        easterEggContext.lineWidth = 1.1;
        for (let index = 0; index < 3; index += 1) {
          const length = 24 + index * 11;
          const height = 7 + index * 5;
          easterEggContext.beginPath();
          easterEggContext.moveTo(
            player.x - player.slideDirection * (18 + index * 8),
            player.y - height
          );
          easterEggContext.lineTo(
            player.x - player.slideDirection * (18 + index * 8 + length),
            player.y - height
          );
          easterEggContext.stroke();
        }
        easterEggContext.restore();
      }

      drawPolygonCharacter(
        easterEggContext,
        easterEggState.player,
        characterProgress
      );
    }

    if (easterEggState.live) {
      bossEncounter?.drawFront(easterEggContext, bossWorld);
    }

    easterEggState.frameRequest = requestAnimationFrame(drawEasterEggFrame);
  }

  function activateEasterEgg() {
    if (
      easterEggState.active ||
      easterEggState.exiting ||
      !isDesktopEasterEggAvailable()
    ) {
      return;
    }

    easterEggState.active = true;
    easterEggState.live = false;
    easterEggState.sceneVisible = false;
    easterEggState.savedScrollY = window.scrollY;
    easterEggState.keys.clear();
    closeModal();
    clearSelectionGeometry();
    window.getSelection()?.removeAllRanges();
    document.documentElement.classList.add("easter-egg-lock");
    document.body.classList.add(
      "easter-egg-lock",
      "easter-egg-entering"
    );
    playEasterEggActivationSound();

    scheduleEasterEggAction(() => {
      if (!easterEggState.active) {
        return;
      }

      updateEasterEggEyeTarget();
      const eyeGeometry = getEyeGeometry(
        eyeCanvas.offsetWidth,
        eyeCanvas.offsetHeight
      );
      eyeX = eyeGeometry.eyeCenterX;
      eyeY = eyeGeometry.eyeCenterY;
      eyeTargetX = eyeX;
      eyeTargetY = eyeY;
      document.body.classList.add(
        "easter-egg-content-hidden",
        "easter-egg-scene"
      );
      window.scrollTo(0, 0);
      easterEggStage.classList.add("is-active");
      easterEggStage.setAttribute("aria-hidden", "false");
      easterEggState.sceneVisible = true;
      easterEggState.sceneStartedAt = performance.now();
      easterEggState.lastFrameAt = 0;
      resizeEasterEggCanvas(true);
      cancelAnimationFrame(easterEggState.frameRequest);
      easterEggState.frameRequest = requestAnimationFrame(drawEasterEggFrame);

      scheduleEasterEggAction(() => {
        if (!easterEggState.active) {
          return;
        }
        easterEggState.live = true;
        easterEggStage.classList.add("is-live");
        easterEggStage.dataset.soundCue = "ready";
        bossEncounter?.start(getBossFightWorld());
        startBossBattleMusic();
      }, 2900);
    }, 500);
  }

  function exitEasterEgg() {
    if (!easterEggState.active || easterEggState.exiting) {
      return;
    }

    clearEasterEggTimers();
    stopEasterEggSounds();
    bossEncounter?.stop();
    easterEggState.active = false;
    easterEggState.live = false;
    easterEggState.exiting = true;
    easterEggState.sceneVisible = false;
    easterEggState.keys.clear();
    cancelAnimationFrame(easterEggState.frameRequest);
    easterEggStage.classList.remove("is-live", "is-active");
    easterEggStage.setAttribute("aria-hidden", "true");
    document.body.classList.remove("easter-egg-scene");
    document.body.classList.remove(
      "boss-death-scene",
      "boss-victory-scene",
      "boss-splintered",
      "boss-cursor-phase"
    );
    easterEggStage.classList.remove(
      "is-death-scene",
      "is-victory-scene",
      "is-cursor-phase"
    );

    window.setTimeout(() => {
      document.body.classList.remove("easter-egg-content-hidden");
      window.scrollTo(0, easterEggState.savedScrollY);
      requestAnimationFrame(() => {
        document.body.classList.remove("easter-egg-entering");
      });
      resizeEyeCanvas();
    }, 1120);

    window.setTimeout(() => {
      document.documentElement.classList.remove("easter-egg-lock");
      document.body.classList.remove("easter-egg-lock");
      window.scrollTo(0, easterEggState.savedScrollY);
      easterEggState.exiting = false;
      queueSelectionUpdate();
    }, 1580);
  }

  const linkSelector = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[data-cursor='link']"
  ].join(",");

  const textSelector = [
    "p",
    "span",
    "li",
    "blockquote",
    "figcaption",
    "label",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "[contenteditable='true']",
    "[data-cursor='text']"
  ].join(",");

  function setCustomCursorEnabled(enabled) {
    customCursorEnabled = Boolean(enabled);
    document.body.classList.toggle(
      "custom-cursor-enabled",
      customCursorEnabled
    );
    cursorToggle.setAttribute("aria-pressed", String(customCursorEnabled));
    cursorToggleState.textContent = customCursorEnabled ? "On" : "Off";

    if (!customCursorEnabled) {
      cursor.classList.remove("is-visible", "is-dark-on-light");
      applyCursorState("default");
    }
  }

  function bossRequiresCustomCursor() {
    return document.body.classList.contains("easter-egg-scene") &&
      document.body.classList.contains("boss-cursor-phase");
  }

  function shouldRenderCustomCursor() {
    return customCursorEnabled || bossRequiresCustomCursor();
  }

  cursorToggle.addEventListener("click", () => {
    setCustomCursorEnabled(!customCursorEnabled);
  });

  let emailCopyResetTimer = 0;

  async function copyEmailAddress() {
    const email = copyEmailButton?.dataset.email;

    if (!email || !emailCopyStatus) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = email;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();

        if (!copied) {
          throw new Error("Clipboard copy was unavailable");
        }
      }

      window.clearTimeout(emailCopyResetTimer);
      copyEmailButton.classList.add("is-copied");
      emailCopyStatus.textContent = "Copied to clipboard";
      emailCopyResetTimer = window.setTimeout(() => {
        copyEmailButton.classList.remove("is-copied");
        emailCopyStatus.textContent = email;
      }, 2400);
    } catch {
      emailCopyStatus.textContent = `Copy failed — ${email}`;
    }
  }

  copyEmailButton?.addEventListener("click", copyEmailAddress);

  function setPointerPosition(event) {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.insideViewport = true;
    bossEncounter?.pointerMove(event.clientX, event.clientY);
  }

  function isExpandedModalImage(element) {
    return Boolean(element && element.closest("#modalImage"));
  }

  function getCursorState(element) {
    if (!element) {
      return "default";
    }

    if (modal.classList.contains("is-open") && !isExpandedModalImage(element)) {
      return "close";
    }

    if (!isExpandedModalImage(element) && element.closest("img")) {
      return "image";
    }

    if (element.closest(linkSelector)) {
      return "link";
    }

    if (element.closest(textSelector)) {
      return "text";
    }

    return "default";
  }

  function applyCursorState(state) {
    cursor.classList.toggle("is-text", state === "text");
    cursor.classList.toggle("is-link", state === "link");
    cursor.classList.toggle("is-image", state === "image");
    cursor.classList.toggle("is-close", state === "close");
  }

  function parseCssColor(color) {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
      return null;
    }

    return {
      red: Number(channels[0]),
      green: Number(channels[1]),
      blue: Number(channels[2]),
      alpha: channels.length > 3 ? Number(channels[3]) : 1
    };
  }

  function isLightColor({ red, green, blue, alpha = 1 }) {
    if (alpha < 0.72) {
      return false;
    }

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    return luminance >= 214 && Math.min(red, green, blue) >= 190;
  }

  function getElementSurfaceColor(element) {
    let current = element;
    while (current && current !== document.documentElement) {
      const backgroundColor = parseCssColor(
        window.getComputedStyle(current).backgroundColor
      );
      if (backgroundColor && backgroundColor.alpha >= 0.72) {
        return backgroundColor;
      }
      current = current.parentElement;
    }

    return {
      red: 7,
      green: 11,
      blue: 18,
      alpha: 1
    };
  }

  function getImageSampleData(image) {
    const source = image.currentSrc || image.src;
    const cached = cursorImageSampleCache.get(image);
    if (
      cached &&
      cached.source === source &&
      cached.naturalWidth === image.naturalWidth &&
      cached.naturalHeight === image.naturalHeight
    ) {
      return cached;
    }

    if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
      return null;
    }

    const maximumDimension = 180;
    const scale = Math.min(
      1,
      maximumDimension / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const sampleCanvas = document.createElement("canvas");
    const sampleContext = sampleCanvas.getContext(
      "2d",
      { willReadFrequently: true }
    );
    const sample = {
      source,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width,
      height,
      pixels: null
    };

    sampleCanvas.width = width;
    sampleCanvas.height = height;

    try {
      sampleContext.drawImage(image, 0, 0, width, height);
      sample.pixels = sampleContext.getImageData(0, 0, width, height).data;
    } catch {
      // Cross-origin images cannot always be sampled; their visible CSS
      // background and surrounding surface remain a safe contrast fallback.
    }

    cursorImageSampleCache.set(image, sample);
    return sample;
  }

  function getObjectPositionFraction(value, axis) {
    const normalized = value.toLowerCase();
    if (normalized.endsWith("%")) {
      return Number.parseFloat(normalized) / 100;
    }
    if (normalized === "left" || normalized === "top") {
      return 0;
    }
    if (normalized === "right" || normalized === "bottom") {
      return 1;
    }
    if (normalized === "center") {
      return 0.5;
    }
    return axis === "x" ? 0.5 : 0.5;
  }

  function sampleImageColor(image, clientX, clientY) {
    const sample = getImageSampleData(image);
    if (!sample || !sample.pixels) {
      return null;
    }

    const rect = image.getBoundingClientRect();
    const style = window.getComputedStyle(image);
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    let renderedWidth = rect.width;
    let renderedHeight = rect.height;

    if (style.objectFit === "cover" || style.objectFit === "contain") {
      const scale = style.objectFit === "cover"
        ? Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
        : Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
      renderedWidth = naturalWidth * scale;
      renderedHeight = naturalHeight * scale;
    }

    const positionParts = style.objectPosition.trim().split(/\s+/);
    const positionX = getObjectPositionFraction(positionParts[0] || "50%", "x");
    const positionY = getObjectPositionFraction(
      positionParts[1] || positionParts[0] || "50%",
      "y"
    );
    const renderedLeft = rect.left + (rect.width - renderedWidth) * positionX;
    const renderedTop = rect.top + (rect.height - renderedHeight) * positionY;
    const normalizedX = (clientX - renderedLeft) / renderedWidth;
    const normalizedY = (clientY - renderedTop) / renderedHeight;

    if (
      normalizedX < 0 ||
      normalizedX > 1 ||
      normalizedY < 0 ||
      normalizedY > 1
    ) {
      return null;
    }

    const sampleX = Math.min(
      sample.width - 1,
      Math.max(0, Math.floor(normalizedX * sample.width))
    );
    const sampleY = Math.min(
      sample.height - 1,
      Math.max(0, Math.floor(normalizedY * sample.height))
    );
    const pixelIndex = (sampleY * sample.width + sampleX) * 4;
    const alpha = sample.pixels[pixelIndex + 3] / 255;

    if (alpha < 0.72) {
      return null;
    }

    return {
      red: sample.pixels[pixelIndex],
      green: sample.pixels[pixelIndex + 1],
      blue: sample.pixels[pixelIndex + 2],
      alpha
    };
  }

  function isCursorMostlyOverLightSurface() {
    let lightSamples = 0;
    let totalSamples = 0;
    let imageSamples = 0;
    let luminanceTotal = 0;

    cursorSampleOffsets.forEach((offsetY) => {
      cursorSampleOffsets.forEach((offsetX) => {
        const clientX = Math.max(
          0,
          Math.min(window.innerWidth - 1, pointer.clientX + offsetX)
        );
        const clientY = Math.max(
          0,
          Math.min(window.innerHeight - 1, pointer.clientY + offsetY)
        );
        const element = document.elementFromPoint(clientX, clientY);
        if (!element) {
          return;
        }

        const image = element.closest("img");
        const sampledColor = image
          ? sampleImageColor(image, clientX, clientY)
          : null;
        const surfaceColor = sampledColor || getElementSurfaceColor(element);

        totalSamples += 1;
        luminanceTotal += (
          surfaceColor.red * 0.2126 +
          surfaceColor.green * 0.7152 +
          surfaceColor.blue * 0.0722
        );
        if (sampledColor) {
          imageSamples += 1;
        }
        if (isLightColor(surfaceColor)) {
          lightSamples += 1;
        }
      });
    });

    if (!totalSamples) {
      return false;
    }

    const lightRatio = lightSamples / totalSamples;
    const imageCoverage = imageSamples / totalSamples;
    const averageLuminance = luminanceTotal / totalSamples;
    return (
      lightRatio >= 0.6 ||
      (imageCoverage >= 0.6 && averageLuminance >= 178)
    );
  }

  function updateCursorContrast(now) {
    const distanceMoved = Math.hypot(
      pointer.clientX - cursorContrastSample.x,
      pointer.clientY - cursorContrastSample.y
    );
    if (distanceMoved < 1.5 && now - cursorContrastSample.time < 90) {
      return;
    }

    cursorContrastSample.x = pointer.clientX;
    cursorContrastSample.y = pointer.clientY;
    cursorContrastSample.time = now;
    cursor.classList.toggle(
      "is-dark-on-light",
      isCursorMostlyOverLightSurface()
    );
  }

  function updateCursor(now = performance.now()) {
    if (!shouldRenderCustomCursor()) {
      cursor.classList.remove("is-visible", "is-dark-on-light");
      requestAnimationFrame(updateCursor);
      return;
    }

    if (pointer.insideViewport) {
      const cursorHalf = cursor.getBoundingClientRect().width / 2 || 9;
      cursor.classList.add("is-visible");
      cursor.style.transform =
        `translate3d(${pointer.clientX - cursorHalf}px, ${pointer.clientY - cursorHalf}px, 0)`;

      const elementUnderPointer = document.elementFromPoint(
        pointer.clientX,
        pointer.clientY
      );

      applyCursorState(getCursorState(elementUnderPointer));
      updateCursorContrast(now);
    } else {
      cursor.classList.remove("is-visible");
      cursor.classList.remove("is-dark-on-light");
    }

    requestAnimationFrame(updateCursor);
  }

  function resizeEyeCanvas() {
    const rect = eyeCanvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    eyeCanvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    eyeCanvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    eyeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const geometry = getEyeGeometry(rect.width, rect.height);
    eyeX = geometry.eyeCenterX;
    eyeY = geometry.eyeCenterY;
    eyeTargetX = eyeX;
    eyeTargetY = eyeY;
  }

  function updateEasterEggEyeTarget() {
    const width = eyeCanvas.offsetWidth;
    const height = eyeCanvas.offsetHeight;
    const geometry = getEyeGeometry(width, height);
    const baseCenterX = eyePanel.offsetLeft + eyePanel.offsetWidth * 0.5;
    const baseCenterY = (
      eyePanel.offsetTop +
      eyeCanvas.offsetTop +
      geometry.eyeCenterY
    );
    const targetCenterX = window.innerWidth * 0.5;
    const targetCenterY = Math.max(
      82,
      Math.min(108, window.innerHeight * 0.105)
    );

    document.documentElement.style.setProperty(
      "--easter-eye-shift-x",
      `${targetCenterX - baseCenterX}px`
    );
    document.documentElement.style.setProperty(
      "--easter-eye-shift-y",
      `${targetCenterY - baseCenterY}px`
    );
  }

  function getEyeGeometry(width, height) {
    const eyeCenterX = width * 0.50;
    const eyeCenterY = height * 0.63;
    const eyeHalfWidth = width * 0.40;
    const eyeHalfHeight = Math.min(width * 0.14, height * 0.28);
    const eyeballRadius = Math.min(width * 0.105, height * 0.20);
    const irisRadius = eyeballRadius * 0.34;

    return {
      eyeCenterX,
      eyeCenterY,
      eyeHalfWidth,
      eyeHalfHeight,
      eyeballRadius,
      irisRadius,
      maxIrisOffset: eyeballRadius - irisRadius - 3
    };
  }

  function getLookDirection(eyeScreenX, eyeScreenY) {
    let targetX = pointer.clientX;
    let targetY = pointer.clientY;

    if (
      easterEggState.active &&
      easterEggState.sceneVisible &&
      !easterEggState.live
    ) {
      return { x: 0, y: 0 };
    }

    if (easterEggState.active && easterEggState.sceneVisible) {
      if (
        easterEggStage.dataset.phase === "3" &&
        document.body.classList.contains("boss-cursor-phase")
      ) {
        targetX = pointer.clientX;
        targetY = pointer.clientY;
      } else {
        targetX = easterEggState.player.x;
        targetY = easterEggState.player.y - 34;
      }
    } else if (selectionState.active && selectionState.center) {
      targetX = selectionState.center.x;
      targetY = selectionState.center.y;
    } else if (pointer.clientX < window.innerWidth * 0.25) {
      return { x: 0, y: -1 };
    }

    const deltaX = targetX - eyeScreenX;
    const deltaY = targetY - eyeScreenY;
    const distance = Math.hypot(deltaX, deltaY) || 1;

    return {
      x: deltaX / distance,
      y: deltaY / distance
    };
  }

  function drawIrritationLines(geometry) {
    if (!irritationLevel) {
      return;
    }

    const mainCounts = [0, 3, 5, 7];
    const mainWidths = [0, 1.3, 1.8, 2.35];
    const branchWidths = [0, 0.7, 1.0, 1.35];
    const reachFactors = [0, 0.34, 0.66, 1];
    const stopRadius = geometry.eyeballRadius + 3;

    eyeContext.save();
    eyeContext.beginPath();
    eyeContext.moveTo(
      geometry.eyeCenterX - geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY - geometry.eyeHalfHeight,
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY - geometry.eyeHalfHeight,
      geometry.eyeCenterX + geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY + geometry.eyeHalfHeight,
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY + geometry.eyeHalfHeight,
      geometry.eyeCenterX - geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.closePath();
    eyeContext.arc(
      geometry.eyeCenterX,
      geometry.eyeCenterY,
      geometry.eyeballRadius + 1,
      0,
      Math.PI * 2
    );
    eyeContext.clip("evenodd");

    eyeContext.strokeStyle = "#ff1f2d";
    eyeContext.lineCap = "square";
    eyeContext.lineJoin = "miter";

    const drawJagged = (points, width) => {
      eyeContext.lineWidth = width;
      eyeContext.beginPath();
      eyeContext.moveTo(points[0].x, points[0].y);
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        eyeContext.lineTo(points[pointIndex].x, points[pointIndex].y);
      }
      eyeContext.stroke();
    };

    const pointAtStop = (start, reachFactor) => {
      const dx = geometry.eyeCenterX - start.x;
      const dy = geometry.eyeCenterY - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const scale = Math.max(0, ((distance - stopRadius) / distance) * reachFactor);
      return {
        x: start.x + dx * scale,
        y: start.y + dy * scale
      };
    };

    const drawVein = (start, index, side) => {
      const end = pointAtStop(start, reachFactors[irritationLevel]);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const normalX = -dy / distance;
      const normalY = dx / distance;
      const bend = 2 + irritationLevel * 1.15;
      const middle = {
        x: start.x + dx * 0.52 + normalX * bend * Math.sin(index * 2.4 + side),
        y: start.y + dy * 0.52 + normalY * bend * Math.sin(index * 2.4 + side)
      };

      drawJagged([start, middle, end], mainWidths[irritationLevel]);

      const branchCount = irritationLevel === 1 ? 0 : irritationLevel - 1;
      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const branchStartRatio = 0.42 + branchIndex * 0.18;
        const branchStart = {
          x: start.x + dx * branchStartRatio,
          y: start.y + dy * branchStartRatio
        };
        const branchDirection = branchIndex % 2 === 0 ? 1 : -1;
        const branchLength = 5 + irritationLevel * 2.5 - branchIndex * 1.25;
        const branchEnd = {
          x: branchStart.x + normalX * branchLength * branchDirection + (dx / distance) * branchLength * 0.28,
          y: branchStart.y + normalY * branchLength * branchDirection + (dy / distance) * branchLength * 0.28
        };

        drawJagged([
          branchStart,
          {
            x: (branchStart.x + branchEnd.x) / 2 + normalX * branchDirection * 1.5,
            y: (branchStart.y + branchEnd.y) / 2 + normalY * branchDirection * 1.5
          },
          branchEnd
        ], branchWidths[irritationLevel]);
      }
    };

    for (const side of [-1, 1]) {
      const count = mainCounts[irritationLevel];
      for (let index = 0; index < count; index += 1) {
        const fraction = count === 1 ? 0.5 : index / (count - 1);
        const normalizedX = fraction * 1.78 - 0.89;
        const edgeHeight = Math.pow(Math.max(0, 1 - normalizedX * normalizedX), 0.58);
        const start = {
          x: geometry.eyeCenterX + normalizedX * geometry.eyeHalfWidth,
          y: geometry.eyeCenterY + side * geometry.eyeHalfHeight * edgeHeight * 0.96
        };
        drawVein(start, index, side);
      }
    }

    eyeContext.restore();
  }

  function drawBossPhaseMarks(geometry) {
    if (!easterEggState.live) {
      return;
    }
    const phase = Number(easterEggStage.dataset.phase || 1);
    const defeated = easterEggStage.dataset.phaseState === "defeated";
    const now = performance.now() / 1000;
    const colors = ["", "#ff1f2d", "#ff8f26", "#fff048"];
    const color = defeated ? "#69ddff" : colors[phase];
    const ringCount = defeated ? 3 : phase;

    eyeContext.save();
    eyeContext.strokeStyle = color;
    eyeContext.lineCap = "square";
    for (let index = 0; index < ringCount; index += 1) {
      const pulse = Math.sin(now * (2.1 + index * 0.28) + index * 1.7);
      const radius = geometry.eyeballRadius + 7 + index * 5 + pulse * 1.2;
      const rotation = now * (index % 2 ? -0.22 : 0.18) + index * 0.9;
      eyeContext.globalAlpha = defeated
        ? 0.28 - index * 0.055
        : 0.16 + phase * 0.035 - index * 0.035;
      eyeContext.lineWidth = index === 0 ? 1.15 : 0.8;
      for (let segment = 0; segment < 4; segment += 1) {
        const start = rotation + segment * Math.PI / 2;
        eyeContext.beginPath();
        eyeContext.arc(
          geometry.eyeCenterX,
          geometry.eyeCenterY,
          radius,
          start,
          start + Math.PI * (0.23 + phase * 0.025)
        );
        eyeContext.stroke();
      }
    }
    eyeContext.restore();
  }

  const victoryCrackEdges = [
    { normalizedX: -0.82, side: -1, inward: 0.27, jagged: false },
    { normalizedX: -0.24, side: -1, inward: 0.49, jagged: true },
    { normalizedX: 0.72, side: -1, inward: 0.34, jagged: false },
    { normalizedX: 0.52, side: 1, inward: 0.56, jagged: true },
    { normalizedX: -0.58, side: 1, inward: 0.39, jagged: false }
  ];

  function resetVictoryIrisTwitch() {
    if (!victoryIrisTwitch.active) {
      return;
    }
    victoryIrisTwitch.active = false;
    victoryIrisTwitch.nextJoltAt = 0;
    victoryIrisTwitch.x = 0;
    victoryIrisTwitch.y = 0;
    victoryIrisTwitch.rotation = 0;
    victoryIrisTwitch.scaleX = 1;
    victoryIrisTwitch.scaleY = 1;
    victoryIrisTwitch.targetX = 0;
    victoryIrisTwitch.targetY = 0;
    victoryIrisTwitch.targetRotation = 0;
    victoryIrisTwitch.targetScaleX = 1;
    victoryIrisTwitch.targetScaleY = 1;
  }

  function updateVictoryIrisTwitch(now) {
    const victoryTime = Number(easterEggStage.dataset.victoryTime || 0);
    const twitchStart = 0.64;
    const splinterAt = 4.75;
    const twitching = (
      easterEggStage.dataset.phaseState === "defeated" &&
      victoryTime >= twitchStart &&
      victoryTime < splinterAt &&
      !document.body.classList.contains("boss-splintered")
    );

    if (!twitching) {
      resetVictoryIrisTwitch();
      return;
    }

    if (!victoryIrisTwitch.active) {
      victoryIrisTwitch.active = true;
      victoryIrisTwitch.nextJoltAt = now;
    }

    const progress = Math.max(
      0,
      Math.min(1, (victoryTime - twitchStart) / (splinterAt - twitchStart))
    );
    const crackDelays = [0.82, 1.58, 2.34, 3.1, 3.86];
    const cracksVisible = crackDelays.filter((delay) => victoryTime >= delay).length;
    const crackBurst = crackDelays.reduce((strongest, delay) => {
      const age = victoryTime - delay;
      if (age < 0 || age > 0.46) {
        return strongest;
      }
      return Math.max(strongest, Math.pow(1 - age / 0.46, 2));
    }, 0);

    if (now >= victoryIrisTwitch.nextJoltAt) {
      const irregularRest = (
        crackBurst < 0.34 &&
        Math.random() < Math.max(0.06, 0.24 - progress * 0.16)
      );
      const amplitude = (
        0.45 +
        Math.pow(progress, 1.45) * 4.8 +
        cracksVisible * 0.35 +
        crackBurst * 2.4
      );
      const directionBias = Math.random() < 0.5 ? -1 : 1;
      victoryIrisTwitch.targetX = irregularRest
        ? 0
        : directionBias * amplitude * (0.48 + Math.random() * 0.72);
      victoryIrisTwitch.targetY = irregularRest
        ? 0
        : (Math.random() * 2 - 1) * amplitude * 0.58;
      victoryIrisTwitch.targetRotation = irregularRest
        ? 0
        : directionBias * (0.08 + Math.random() * (0.4 + progress * 1.15));
      const distortion = irregularRest
        ? 0
        : (Math.random() * 2 - 1) * (0.003 + progress * 0.016);
      victoryIrisTwitch.targetScaleX = 1 + distortion;
      victoryIrisTwitch.targetScaleY = 1 - distortion * 0.72;
      victoryIrisTwitch.nextJoltAt = now + (
        42 +
        (1 - progress) * 74 +
        Math.random() * (88 - progress * 48)
      );
    }

    const follow = 0.48 + progress * 0.3 + crackBurst * 0.12;
    victoryIrisTwitch.x += (
      victoryIrisTwitch.targetX - victoryIrisTwitch.x
    ) * follow;
    victoryIrisTwitch.y += (
      victoryIrisTwitch.targetY - victoryIrisTwitch.y
    ) * follow;
    victoryIrisTwitch.rotation += (
      victoryIrisTwitch.targetRotation - victoryIrisTwitch.rotation
    ) * follow;
    victoryIrisTwitch.scaleX += (
      victoryIrisTwitch.targetScaleX - victoryIrisTwitch.scaleX
    ) * follow;
    victoryIrisTwitch.scaleY += (
      victoryIrisTwitch.targetScaleY - victoryIrisTwitch.scaleY
    ) * follow;
  }

  function drawVictoryCracks(geometry) {
    if (
      easterEggStage.dataset.phaseState !== "defeated" ||
      document.body.classList.contains("boss-splintered")
    ) {
      return;
    }
    const victoryTime = Number(easterEggStage.dataset.victoryTime || 0);
    eyeContext.save();
    eyeContext.beginPath();
    eyeContext.moveTo(
      geometry.eyeCenterX - geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY - geometry.eyeHalfHeight,
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY - geometry.eyeHalfHeight,
      geometry.eyeCenterX + geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY + geometry.eyeHalfHeight,
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      geometry.eyeCenterY + geometry.eyeHalfHeight,
      geometry.eyeCenterX - geometry.eyeHalfWidth,
      geometry.eyeCenterY
    );
    eyeContext.closePath();
    eyeContext.clip();
    victoryCrackEdges.forEach((crack, index) => {
      const { normalizedX, side, inward, jagged } = crack;
      const delay = 0.82 + index * 0.76;
      const progress = Math.max(
        0,
        Math.min(1, (victoryTime - delay + 0.18) / 0.48)
      );
      if (!progress) {
        return;
      }
      const edgeHeight = Math.pow(
        Math.max(0, 1 - normalizedX * normalizedX),
        0.58
      );
      const rim = {
        x: geometry.eyeCenterX + normalizedX * geometry.eyeHalfWidth,
        y: geometry.eyeCenterY + side * geometry.eyeHalfHeight * edgeHeight
      };
      const visibleInward = inward * easeOutCubic(progress);
      const tip = {
        x: rim.x + (geometry.eyeCenterX - rim.x) * visibleInward,
        y: rim.y + (geometry.eyeCenterY - rim.y) * visibleInward
      };
      const dx = tip.x - rim.x;
      const dy = tip.y - rim.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normalX = -dy / distance;
      const normalY = dx / distance;
      const bend = (index % 2 ? -1 : 1) * (5 + index % 3 * 2);
      const middle = {
        x: rim.x + dx * 0.52 + normalX * bend * (jagged ? -0.78 : 0.18),
        y: rim.y + dy * 0.52 + normalY * bend * (jagged ? -0.78 : 0.18)
      };
      const firstJag = {
        x: rim.x + dx * 0.27 + normalX * bend * 0.58,
        y: rim.y + dy * 0.27 + normalY * bend * 0.58
      };
      const lastJag = {
        x: rim.x + dx * 0.76 + normalX * bend * 0.34,
        y: rim.y + dy * 0.76 + normalY * bend * 0.34
      };
      eyeContext.save();
      eyeContext.strokeStyle = "#ffffff";
      eyeContext.shadowColor = "#ffffff";
      eyeContext.shadowBlur = 12 + progress * 16;
      eyeContext.lineWidth = 1.2 + progress * 1.5;
      eyeContext.beginPath();
      eyeContext.moveTo(rim.x, rim.y);
      if (jagged) {
        eyeContext.lineTo(firstJag.x, firstJag.y);
        eyeContext.lineTo(middle.x, middle.y);
        eyeContext.lineTo(lastJag.x, lastJag.y);
      } else {
        eyeContext.lineTo(middle.x, middle.y);
      }
      eyeContext.lineTo(tip.x, tip.y);
      eyeContext.stroke();
      if (progress > 0.58) {
        eyeContext.lineWidth = 0.85;
        eyeContext.beginPath();
        eyeContext.moveTo(middle.x, middle.y);
        eyeContext.lineTo(
          middle.x - dy / distance * (8 + index % 3 * 3),
          middle.y + dx / distance * (8 + index % 3 * 3)
        );
        eyeContext.stroke();
      }
      eyeContext.restore();
    });
    eyeContext.restore();
  }

  function drawTechEye(now = performance.now()) {
    const rect = eyeCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const geometry = getEyeGeometry(width, height);

    eyeContext.clearRect(0, 0, width, height);

    const eyeScreenX = rect.left + geometry.eyeCenterX;
    const eyeScreenY = rect.top + geometry.eyeCenterY;
    const direction = getLookDirection(eyeScreenX, eyeScreenY);

    const defeated = easterEggStage.dataset.phaseState === "defeated";
    const victoryTime = Number(easterEggStage.dataset.victoryTime || 0);
    eyeTargetX = defeated
      ? geometry.eyeCenterX
      : geometry.eyeCenterX + direction.x * geometry.maxIrisOffset;
    eyeTargetY = defeated
      ? geometry.eyeCenterY
      : geometry.eyeCenterY + direction.y * geometry.maxIrisOffset;

    if (defeated) {
      const recenterProgress = easeOutCubic(
        Math.max(0, Math.min(1, victoryTime / 0.62))
      );
      const recenterFollow = 0.08 + recenterProgress * 0.34;
      eyeX += (geometry.eyeCenterX - eyeX) * recenterFollow;
      eyeY += (geometry.eyeCenterY - eyeY) * recenterFollow;
    } else if (selectionState.active) {
      /* Selection owns the gaze completely until the selection is released. */
      eyeX = eyeTargetX;
      eyeY = eyeTargetY;
    } else {
      eyeX += (eyeTargetX - eyeX) * 0.14;
      eyeY += (eyeTargetY - eyeY) * 0.14;
    }

    updateVictoryIrisTwitch(now);
    const irisX = eyeX + victoryIrisTwitch.x;
    const irisY = eyeY + victoryIrisTwitch.y;

    eyePupil.setAttribute("cx", rect.left + irisX);
    eyePupil.setAttribute("cy", rect.top + irisY);
    eyePupil.setAttribute("r", geometry.irisRadius);

    eyeContext.save();
    eyeContext.lineCap = "square";
    eyeContext.lineJoin = "miter";

    const left = geometry.eyeCenterX - geometry.eyeHalfWidth;
    const right = geometry.eyeCenterX + geometry.eyeHalfWidth;
    const top = geometry.eyeCenterY - geometry.eyeHalfHeight;
    const bottom = geometry.eyeCenterY + geometry.eyeHalfHeight;

    eyeContext.beginPath();
    eyeContext.moveTo(left, geometry.eyeCenterY);
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      top,
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      top,
      right,
      geometry.eyeCenterY
    );
    eyeContext.bezierCurveTo(
      geometry.eyeCenterX + geometry.eyeHalfWidth * 0.48,
      bottom,
      geometry.eyeCenterX - geometry.eyeHalfWidth * 0.48,
      bottom,
      left,
      geometry.eyeCenterY
    );
    eyeContext.strokeStyle = "rgba(139, 149, 159, 0.88)";
    eyeContext.lineWidth = 1.35;
    eyeContext.stroke();

    eyeContext.beginPath();
    eyeContext.arc(
      geometry.eyeCenterX,
      geometry.eyeCenterY,
      geometry.eyeballRadius,
      0,
      Math.PI * 2
    );
    eyeContext.strokeStyle = "rgba(139, 149, 159, 0.46)";
    eyeContext.lineWidth = 1;
    eyeContext.stroke();

    drawBossPhaseMarks(geometry);
    drawIrritationLines(geometry);

    /* Keep the red vessels beneath the iris and pupil. */
    eyeContext.beginPath();
    eyeContext.ellipse(
      irisX,
      irisY,
      geometry.irisRadius * victoryIrisTwitch.scaleX,
      geometry.irisRadius * victoryIrisTwitch.scaleY,
      victoryIrisTwitch.rotation * Math.PI / 180,
      0,
      Math.PI * 2
    );
    eyeContext.fillStyle = defeated
      ? "#b6d4dc"
      : "#929ca5";
    eyeContext.fill();

    drawVictoryCracks(geometry);

    const terminal = Math.max(9, width * 0.035);
    eyeContext.beginPath();
    eyeContext.moveTo(left, geometry.eyeCenterY);
    eyeContext.lineTo(left - terminal, geometry.eyeCenterY);
    eyeContext.lineTo(left - terminal - 5, geometry.eyeCenterY - 7);

    eyeContext.moveTo(right, geometry.eyeCenterY);
    eyeContext.lineTo(right + terminal, geometry.eyeCenterY);
    eyeContext.lineTo(right + terminal + 5, geometry.eyeCenterY + 7);
    eyeContext.strokeStyle = "rgba(139, 149, 159, 0.42)";
    eyeContext.lineWidth = 1;
    eyeContext.stroke();

    eyeContext.restore();

    updateSelectionConnectorLines({
      x: rect.left + irisX,
      y: rect.top + irisY
    });

    requestAnimationFrame(drawTechEye);
  }

  function nodeIsInsideContent(node) {
    if (!node) {
      return false;
    }

    const element = node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement;

    return Boolean(element && content.contains(element));
  }

  function snap(value) {
    return Math.round(value * 2) / 2;
  }

  function groupSelectionRects(rawRects) {
    const rects = rawRects
      .map((rect) => ({
        left: snap(rect.left - 2),
        right: snap(rect.right + 2),
        top: snap(rect.top - 1),
        bottom: snap(rect.bottom + 1)
      }))
      .filter((rect) => rect.right - rect.left > 1 && rect.bottom - rect.top > 1)
      .sort((a, b) => a.top - b.top || a.left - b.left);

    const lines = [];

    for (const rect of rects) {
      const current = lines.at(-1);
      const sameLine = current && (
        Math.abs(rect.top - current.top) <= 3 ||
        Math.min(rect.bottom, current.bottom) - Math.max(rect.top, current.top) > 2
      );

      if (sameLine) {
        current.left = Math.min(current.left, rect.left);
        current.right = Math.max(current.right, rect.right);
        current.top = Math.min(current.top, rect.top);
        current.bottom = Math.max(current.bottom, rect.bottom);
      } else {
        lines.push({ ...rect });
      }
    }

    /*
      Extend neighbouring line rectangles to their shared midpoint. This turns
      a multiline selection into one continuous stair-step region without
      losing the inward corners between lines.
    */
    return lines.map((line, index) => {
      const previous = lines[index - 1];
      const next = lines[index + 1];

      return {
        left: line.left,
        right: line.right,
        top: previous ? snap((previous.bottom + line.top) / 2) : line.top,
        bottom: next ? snap((line.bottom + next.top) / 2) : line.bottom
      };
    });
  }

  function pointKey(point) {
    return `${point.x}:${point.y}`;
  }

  function edgeDirection(edge) {
    if (edge.b.x > edge.a.x) return 0; // east
    if (edge.b.y > edge.a.y) return 1; // south
    if (edge.b.x < edge.a.x) return 2; // west
    return 3; // north
  }

  function simplifyContour(points) {
    const clean = [];

    for (const point of points) {
      const last = clean.at(-1);
      if (!last || last.x !== point.x || last.y !== point.y) {
        clean.push(point);
      }
    }

    if (
      clean.length > 1 &&
      clean[0].x === clean.at(-1).x &&
      clean[0].y === clean.at(-1).y
    ) {
      clean.pop();
    }

    let changed = true;
    while (changed && clean.length > 3) {
      changed = false;

      for (let index = 0; index < clean.length; index += 1) {
        const previous = clean[(index - 1 + clean.length) % clean.length];
        const current = clean[index];
        const next = clean[(index + 1) % clean.length];

        const collinear =
          (previous.x === current.x && current.x === next.x) ||
          (previous.y === current.y && current.y === next.y);

        if (collinear) {
          clean.splice(index, 1);
          changed = true;
          break;
        }
      }
    }

    return clean;
  }

  function buildUnionContours(rects) {
    if (!rects.length) {
      return [];
    }

    const xs = [...new Set(rects.flatMap((rect) => [rect.left, rect.right]))]
      .sort((a, b) => a - b);
    const ys = [...new Set(rects.flatMap((rect) => [rect.top, rect.bottom]))]
      .sort((a, b) => a - b);

    const occupied = Array.from(
      { length: ys.length - 1 },
      () => Array(xs.length - 1).fill(false)
    );

    for (let row = 0; row < ys.length - 1; row += 1) {
      for (let column = 0; column < xs.length - 1; column += 1) {
        const centerX = (xs[column] + xs[column + 1]) / 2;
        const centerY = (ys[row] + ys[row + 1]) / 2;

        occupied[row][column] = rects.some((rect) => (
          centerX > rect.left &&
          centerX < rect.right &&
          centerY > rect.top &&
          centerY < rect.bottom
        ));
      }
    }

    const edges = [];
    const addEdge = (ax, ay, bx, by) => {
      edges.push({
        a: { x: ax, y: ay },
        b: { x: bx, y: by },
        used: false
      });
    };

    for (let row = 0; row < occupied.length; row += 1) {
      for (let column = 0; column < occupied[row].length; column += 1) {
        if (!occupied[row][column]) {
          continue;
        }

        const x0 = xs[column];
        const x1 = xs[column + 1];
        const y0 = ys[row];
        const y1 = ys[row + 1];

        if (row === 0 || !occupied[row - 1][column]) {
          addEdge(x0, y0, x1, y0);
        }
        if (column === occupied[row].length - 1 || !occupied[row][column + 1]) {
          addEdge(x1, y0, x1, y1);
        }
        if (row === occupied.length - 1 || !occupied[row + 1][column]) {
          addEdge(x1, y1, x0, y1);
        }
        if (column === 0 || !occupied[row][column - 1]) {
          addEdge(x0, y1, x0, y0);
        }
      }
    }

    const outgoing = new Map();
    edges.forEach((edge, index) => {
      const key = pointKey(edge.a);
      const list = outgoing.get(key) || [];
      list.push(index);
      outgoing.set(key, list);
    });

    const contours = [];
    const turnPriority = new Map([
      [1, 0], // right turn
      [0, 1], // straight
      [3, 2], // left turn
      [2, 3]  // reverse, only as a final fallback
    ]);

    for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
      if (edges[startIndex].used) {
        continue;
      }

      const startEdge = edges[startIndex];
      const startKey = pointKey(startEdge.a);
      const points = [startEdge.a];
      let currentIndex = startIndex;
      let guard = 0;

      while (guard < edges.length + 2) {
        guard += 1;
        const current = edges[currentIndex];
        current.used = true;
        points.push(current.b);

        if (pointKey(current.b) === startKey) {
          break;
        }

        const candidates = (outgoing.get(pointKey(current.b)) || [])
          .filter((index) => !edges[index].used);

        if (!candidates.length) {
          break;
        }

        const currentDirection = edgeDirection(current);
        candidates.sort((firstIndex, secondIndex) => {
          const firstTurn = (
            edgeDirection(edges[firstIndex]) - currentDirection + 4
          ) % 4;
          const secondTurn = (
            edgeDirection(edges[secondIndex]) - currentDirection + 4
          ) % 4;

          return turnPriority.get(firstTurn) - turnPriority.get(secondTurn);
        });

        currentIndex = candidates[0];
      }

      const contour = simplifyContour(points);
      if (contour.length >= 4) {
        contours.push(contour);
      }
    }

    return contours;
  }

  function contoursToPath(contours) {
    return contours.map((contour) => {
      const [first, ...rest] = contour;
      return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")} Z`;
    }).join(" ");
  }

  function getContoursCenter(contours) {
    let weightedX = 0;
    let weightedY = 0;
    let totalArea = 0;

    for (const contour of contours) {
      let twiceArea = 0;
      let centroidXFactor = 0;
      let centroidYFactor = 0;

      for (let index = 0; index < contour.length; index += 1) {
        const current = contour[index];
        const next = contour[(index + 1) % contour.length];
        const cross = current.x * next.y - next.x * current.y;

        twiceArea += cross;
        centroidXFactor += (current.x + next.x) * cross;
        centroidYFactor += (current.y + next.y) * cross;
      }

      const signedArea = twiceArea / 2;
      if (Math.abs(signedArea) < 0.001) {
        continue;
      }

      const centroidX = centroidXFactor / (6 * signedArea);
      const centroidY = centroidYFactor / (6 * signedArea);
      const area = Math.abs(signedArea);

      weightedX += centroidX * area;
      weightedY += centroidY * area;
      totalArea += area;
    }

    if (!totalArea) {
      return null;
    }

    return {
      x: weightedX / totalArea,
      y: weightedY / totalArea
    };
  }

  function clearSelectionGeometry() {
    selectionState.active = false;
    selectionState.contours = [];
    selectionState.center = null;
    selectionPolygon.removeAttribute("d");
    selectionLines.removeAttribute("d");
    blurLayer.classList.remove("is-active");
    blurLayer.style.removeProperty("mask-image");
    blurLayer.style.removeProperty("-webkit-mask-image");
  }

  function updateSelectionBlur(contours) {
    const selectionPath = contoursToPath(contours);
    const blurRect = blurLayer.getBoundingClientRect();
    const maskWidth = Math.max(1, blurRect.width);
    const maskHeight = Math.max(1, blurRect.height);
    const contentLeft = content.getBoundingClientRect().left;
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskWidth}px" height="${maskHeight}px" viewBox="0 0 ${maskWidth} ${maskHeight}" preserveAspectRatio="none"><path fill="white" fill-rule="evenodd" d="M ${contentLeft} 0 H ${maskWidth} V ${maskHeight} H ${contentLeft} Z ${selectionPath}"/></svg>`;
    const maskUrl = `url("data:image/svg+xml,${encodeURIComponent(maskSvg)}")`;
    blurLayer.style.maskImage = maskUrl;
    blurLayer.style.webkitMaskImage = maskUrl;
    blurLayer.classList.add("is-active");
  }

  function customSelectionEffectsAllowed() {
    return window.innerWidth > 820 &&
      !reducedMotionPreference.matches &&
      !forcedColorsPreference.matches;
  }

  function updateSelectionGeometry() {
    selectionUpdateQueued = false;

    if (!customSelectionEffectsAllowed()) {
      clearSelectionGeometry();
      return;
    }

    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !selection.toString().trim() ||
      !nodeIsInsideContent(selection.anchorNode) ||
      !nodeIsInsideContent(selection.focusNode)
    ) {
      clearSelectionGeometry();
      return;
    }

    const range = selection.getRangeAt(0);
    const rawRects = Array.from(range.getClientRects())
      .filter((rect) => (
        rect.width > 0.5 &&
        rect.height > 0.5 &&
        rect.right > window.innerWidth * 0.25
      ));

    const lineRects = groupSelectionRects(rawRects);
    const contours = buildUnionContours(lineRects);
    const center = getContoursCenter(contours);

    if (!contours.length || !center) {
      clearSelectionGeometry();
      return;
    }

    selectionState.active = true;
    selectionState.contours = contours;
    selectionState.center = center;
    selectionPolygon.setAttribute("d", contoursToPath(contours));
    updateSelectionBlur(contours);
  }

  function queueSelectionUpdate() {
    if (selectionUpdateQueued) {
      return;
    }

    selectionUpdateQueued = true;
    requestAnimationFrame(updateSelectionGeometry);
  }

  function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) -
      (b.y - a.y) * (c.x - a.x);
  }

  function pointOnSegment(point, a, b, epsilon = 0.01) {
    return (
      Math.abs(orientation(a, b, point)) <= epsilon &&
      point.x >= Math.min(a.x, b.x) - epsilon &&
      point.x <= Math.max(a.x, b.x) + epsilon &&
      point.y >= Math.min(a.y, b.y) - epsilon &&
      point.y <= Math.max(a.y, b.y) + epsilon
    );
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    const epsilon = 0.01;

    if (
      ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon)) &&
      ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))
    ) {
      return true;
    }

    return (
      (Math.abs(o1) <= epsilon && pointOnSegment(c, a, b)) ||
      (Math.abs(o2) <= epsilon && pointOnSegment(d, a, b)) ||
      (Math.abs(o3) <= epsilon && pointOnSegment(a, c, d)) ||
      (Math.abs(o4) <= epsilon && pointOnSegment(b, c, d))
    );
  }

  function pointsEqual(first, second, epsilon = 0.01) {
    return Math.abs(first.x - second.x) <= epsilon &&
      Math.abs(first.y - second.y) <= epsilon;
  }

  function isConcaveCorner(contour, index) {
    const previous = contour[(index - 1 + contour.length) % contour.length];
    const current = contour[index];
    const next = contour[(index + 1) % contour.length];

    /* Contours are clockwise in screen coordinates; negative turns are inward. */
    return orientation(previous, current, next) < 0;
  }

  function segmentCrossesPolygon(start, target, contours) {
    for (const contour of contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const edgeStart = contour[index];
        const edgeEnd = contour[(index + 1) % contour.length];

        /* The connector is allowed to terminate on either edge meeting its corner. */
        if (pointsEqual(edgeStart, target) || pointsEqual(edgeEnd, target)) {
          continue;
        }

        if (segmentsIntersect(start, target, edgeStart, edgeEnd)) {
          return true;
        }
      }
    }

    return false;
  }

  function updateSelectionConnectorLines(irisScreenPoint) {
    if (!selectionState.active || !selectionState.contours.length) {
      selectionLines.removeAttribute("d");
      return;
    }

    const commands = [];

    for (const contour of selectionState.contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const corner = contour[index];

        /*
          Inward corners remain part of the bright-blue outline, but they do
          not receive iris connector lines.
        */
        if (isConcaveCorner(contour, index)) {
          continue;
        }

        if (segmentCrossesPolygon(
          irisScreenPoint,
          corner,
          selectionState.contours
        )) {
          continue;
        }

        commands.push(
          `M ${irisScreenPoint.x} ${irisScreenPoint.y} L ${corner.x} ${corner.y}`
        );
      }
    }

    if (commands.length) {
      selectionLines.setAttribute("d", commands.join(" "));
    } else {
      selectionLines.removeAttribute("d");
    }
  }

  function openModal(image) {
    lastFocusedElement = image;
    modalImage.src = image.currentSrc || image.src;
    modalImage.alt = image.alt || "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modal.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) {
      return;
    }

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalImage.removeAttribute("src");

    if (lastFocusedElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll("img:not([data-no-modal])").forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `${image.alt || "Image"} - open full screen`);

    image.addEventListener("click", () => openModal(image));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(image);
      }
    });
  });

  modal.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#modalImage")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (
      easterEggState.active ||
      easterEggState.exiting
    )) {
      event.preventDefault();
      exitEasterEgg();
      return;
    }

    if (event.key === "Escape") {
      closeModal();
      return;
    }

    if (!easterEggState.active) {
      return;
    }

    const key = normalizeEasterEggControlKey(event.key);
    if (!["w", "a", "s", "d", "shift", "space", "j", "l"].includes(key)) {
      return;
    }

    event.preventDefault();
    const newlyPressed = !easterEggState.keys.has(key);
    easterEggState.keys.add(key);

    if (!easterEggState.live) {
      return;
    }

    if (key === "j") {
      bossEncounter?.meleeAttack(
        getEasterEggInputDirection(),
        getBossFightWorld()
      );
      return;
    }

    if (key === "l") {
      bossEncounter?.rangedAttack(
        getEasterEggInputDirection(),
        getBossFightWorld()
      );
      return;
    }

    if (
      key === "s" &&
      newlyPressed &&
      easterEggState.player.grounded &&
      easterEggState.player.slideTime <= 0
    ) {
      easterEggState.player.crouchImpact = 1;
    }

    if (
      (key === "space" || key === "w") &&
      !event.repeat &&
      !event.shiftKey &&
      !easterEggState.keys.has("shift")
    ) {
      queueEasterEggJump();
    }

    if (
      !event.repeat &&
      (
      key === "shift" ||
      event.shiftKey ||
      easterEggState.keys.has("shift")
      )
    ) {
      startEasterEggDash(true, key === "shift");
    }
  });

  document.addEventListener("keyup", (event) => {
    if (!easterEggState.active) {
      return;
    }

    const key = normalizeEasterEggControlKey(event.key);
    if (["w", "a", "s", "d", "shift", "space", "j", "l"].includes(key)) {
      event.preventDefault();
      easterEggState.keys.delete(key);
      if (
        (key === "space" || key === "w") &&
        easterEggState.player.vy < 0 &&
        easterEggState.player.dashTime <= 0
      ) {
        easterEggState.player.vy *= 0.5;
      }
    }
  });

  document.addEventListener("selectionchange", queueSelectionUpdate);
  document.addEventListener("pointerup", queueSelectionUpdate, { passive: true });
  document.addEventListener("keyup", queueSelectionUpdate, { passive: true });
  window.addEventListener("scroll", queueSelectionUpdate, { passive: true, capture: true });

  window.addEventListener("pointermove", setPointerPosition, { passive: true });
  window.addEventListener("pointerdown", setPointerPosition, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    if (
      easterEggState.live &&
      bossEncounter?.pointerDown(event.clientX, event.clientY)
    ) {
      event.preventDefault();
      cursor.classList.add("is-parrying");
      window.setTimeout(() => cursor.classList.remove("is-parrying"), 180);
    }
  }, { passive: false });

  eyeCanvas.addEventListener("click", (event) => {
    const rect = eyeCanvas.getBoundingClientRect();
    const geometry = getEyeGeometry(rect.width, rect.height);
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const normalizedX = (localX - geometry.eyeCenterX) / geometry.eyeHalfWidth;
    const normalizedY = (localY - geometry.eyeCenterY) / geometry.eyeHalfHeight;
    const eyeShapeHeight = Math.max(0, 1 - normalizedX * normalizedX);

    if (
      Math.abs(normalizedX) <= 1 &&
      normalizedY * normalizedY <= eyeShapeHeight
    ) {
      if (irritationLevel < 3) {
        irritationLevel += 1;
        updateSelectionAccent();
        playIrritationShatter(irritationLevel);
        if (irritationLevel === 3) {
          activateEasterEgg();
        }
      } else {
        activateEasterEgg();
      }
    }
  });

  document.documentElement.addEventListener("pointerleave", () => {
    pointer.insideViewport = false;
  });

  document.documentElement.addEventListener("pointerenter", setPointerPosition);

  window.addEventListener("blur", () => {
    pointer.insideViewport = false;
    easterEggState.keys.clear();
  });

  window.addEventListener("resize", () => {
    if (
      (easterEggState.active || easterEggState.exiting) &&
      !isDesktopEasterEggAvailable()
    ) {
      exitEasterEgg();
    }

    resizeEyeCanvas();
    if (easterEggState.active) {
      updateEasterEggEyeTarget();
      resizeEasterEggCanvas();
    }
    queueSelectionUpdate();
  }, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(queueSelectionUpdate).observe(content);
  }

  const handleSelectionPreferenceChange = () => {
    if (!customSelectionEffectsAllowed()) {
      clearSelectionGeometry();
      return;
    }
    queueSelectionUpdate();
  };
  reducedMotionPreference.addEventListener(
    "change",
    handleSelectionPreferenceChange
  );
  forcedColorsPreference.addEventListener(
    "change",
    handleSelectionPreferenceChange
  );

  updateSelectionAccent();
  setCustomCursorEnabled(false);
  prepareSoundAssets();
  initializeBossEncounter();
  resizeEyeCanvas();
  queueSelectionUpdate();
  updateCursor();
  drawTechEye();
})();
