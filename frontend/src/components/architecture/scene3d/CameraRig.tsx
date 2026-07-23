import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gsap } from "gsap";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ArchComponentId } from "../componentData";

interface CameraRigProps {
  restPosition: THREE.Vector3;
  restTarget: THREE.Vector3;
  introStartPosition: THREE.Vector3;
  /** World position of the clicked node to smoothly focus on, or null when nothing is focused. */
  focusPosition: THREE.Vector3 | null;
  /** Identity of the focused node — used (instead of `focusPosition` itself) to detect "a NEW
   *  node was just selected" vs. "the same focus is still active on a re-render." Deselecting
   *  (this going back to null) is deliberately NOT a trigger — see the module docstring. */
  focusKey: ArchComponentId | null;
  /** Bumped by the "Reset View" button. The value itself is never read, only whether it changed. */
  resetSignal: number;
}

const INTRO_DURATION = 2.1;
/** GSAP duration for a fly-to-node/fly-to-rest transition. */
const FLIGHT_DURATION = 1.1;

interface FlightDestination {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * Owns all camera behavior, and ONLY camera behavior — no other component in this scene ever
 * touches `camera.position` or `controls.target`. Three distinct, mutually-exclusive states,
 * driven by GSAP tweens rather than hand-rolled per-frame easing:
 *
 *   1. Intro fly-in (once, on mount, NOT interruptible by user input — matching the original
 *      behavior this rig already shipped with): position eases from a further/offset start to
 *      the resting pose over ~2s. A click during this window is remembered and flown to right
 *      after the intro finishes, rather than being dropped.
 *   2. Idle: OrbitControls owns the camera completely — this rig does not touch
 *      camera.position/controls.target at all (only calls `controls.update()`, which
 *      `enableDamping` requires every frame for its own inertia to work). This is the fix for
 *      the "camera snaps back" bug from before this rig existed: something used to unconditionally
 *      ease the camera toward a "desired" pose *every frame, forever* — when idle, that desired
 *      pose was the rest pose, so the camera was continuously (if slowly) dragged back to rest
 *      even while the user was actively orbiting it away. There is no continuous idle tween here
 *      at all, by construction — GSAP tweens are one-shot, not persistent.
 *   3. Flying (only while transitioning to a newly-focused node, or to the rest pose after
 *      "Reset View" is pressed): a single GSAP tween drives a `{t: 0->1}` progress value; its
 *      `onUpdate` lerps camera position + controls target together (so they never drift out of
 *      sync) and stops — flips back to idle — on `onComplete`, or instantly if the user grabs the
 *      camera mid-flight (`OrbitControls.onStart` kills the tween immediately, matching "once the
 *      user manually interacts, the camera stays exactly where they leave it").
 */
export function CameraRig({ restPosition, restTarget, introStartPosition, focusPosition, focusKey, resetSignal }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const introDone = useRef(false);
  const introProgress = useRef({ t: 0 });
  const flightProgress = useRef({ t: 0 });
  const flightTween = useRef<gsap.core.Tween | null>(null);
  const pendingFlight = useRef<FlightDestination | null>(null);

  const flightStartPosition = useRef(new THREE.Vector3());
  const flightStartTarget = useRef(new THREE.Vector3());
  const flightDestPosition = useRef(restPosition.clone());
  const flightDestTarget = useRef(restTarget.clone());

  const previousFocusKey = useRef<ArchComponentId | null>(null);
  const isFirstResetSignal = useRef(true);

  const startFlight = (destination: FlightDestination) => {
    if (!introDone.current) {
      // Remember the most recent request — replayed once the (non-interruptible) intro
      // finishes, rather than silently dropped.
      pendingFlight.current = destination;
      return;
    }
    flightStartPosition.current.copy(camera.position);
    flightStartTarget.current.copy(controlsRef.current?.target ?? restTarget);
    flightDestPosition.current.copy(destination.position);
    flightDestTarget.current.copy(destination.target);

    flightTween.current?.kill();
    flightProgress.current.t = 0;
    flightTween.current = gsap.to(flightProgress.current, {
      t: 1,
      duration: FLIGHT_DURATION,
      ease: "power2.out",
      onUpdate: () => {
        const controls = controlsRef.current;
        camera.position.lerpVectors(flightStartPosition.current, flightDestPosition.current, flightProgress.current.t);
        controls?.target?.lerpVectors(flightStartTarget.current, flightDestTarget.current, flightProgress.current.t);
        controls?.update();
      },
    });
  };

  useEffect(() => {
    camera.position.copy(introStartPosition);
    gsap.to(introProgress.current, {
      t: 1,
      duration: INTRO_DURATION,
      ease: "power3.out",
      onUpdate: () => {
        camera.position.lerpVectors(introStartPosition, restPosition, introProgress.current.t);
        // Only the camera position flies in during the intro — the look-at target stays fixed
        // at rest throughout so the whole move reads as "pulling back into place", not a pan.
        controlsRef.current?.target?.copy(restTarget);
        controlsRef.current?.update();
      },
      onComplete: () => {
        introDone.current = true;
        if (pendingFlight.current) {
          const destination = pendingFlight.current;
          pendingFlight.current = null;
          startFlight(destination);
        }
      },
    });
    // Intro start/rest pose are only ever read once, at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger #1: a NEW node was just selected. Re-selecting the same node (no key change) or
  // deselecting (key -> null) intentionally does nothing — see the module docstring.
  useEffect(() => {
    if (focusPosition && focusKey !== previousFocusKey.current) {
      const currentTarget = controlsRef.current?.target.clone() ?? restTarget.clone();
      const viewDirection = camera.position.clone().sub(currentTarget);
      if (viewDirection.lengthSq() < 0.0001) viewDirection.set(0, 3, 14);
      const viewDistance = Math.max(8, Math.min(viewDirection.length(), 16));
      startFlight({
        position: focusPosition.clone().add(viewDirection.normalize().multiplyScalar(viewDistance)),
        target: focusPosition.clone(),
      });
    }
    previousFocusKey.current = focusKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, focusPosition]);

  // Trigger #2: the "Reset View" button. Skips the mount-time invocation (resetSignal starts at
  // 0 and hasn't been "pressed" yet) so this never fires on its own.
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }
    startFlight({ position: restPosition.clone(), target: restTarget.clone() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Damping needs `controls.update()` every frame regardless of whether GSAP is actively
  // driving the camera — this is the only per-frame work this rig does outside of tweens.
  useFrame(() => {
    controlsRef.current?.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate
      enableZoom
      enablePan
      screenSpacePanning
      enableDamping
      dampingFactor={0.08}
      autoRotate={false}
      minDistance={10}
      maxDistance={42}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.1}
      onStart={() => {
        // The user grabbed the camera — if a fly-to-node/reset flight was in progress, it must
        // stop immediately rather than keep fighting their drag/zoom/pan. The (non-interruptible,
        // by design) intro tween is deliberately not touched here.
        flightTween.current?.kill();
      }}
    />
  );
}
