import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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
/** Higher = snappier easing toward the desired camera/target position (exponential, frame-rate
 *  independent — see `easeTowards`). */
const FOCUS_EASE_RATE = 2.2;
/** Squared-distance "close enough" cutoff — once both camera.position and controls.target are
 *  within this of their destination, the animation stops and OrbitControls regains full,
 *  uninterrupted control. Without this, the easing above would run forever (asymptotic) and
 *  fight the user the instant they touched the camera. */
const ARRIVAL_EPSILON_SQ = 0.0016;

function easeTowards(current: THREE.Vector3, target: THREE.Vector3, delta: number, rate: number) {
  const factor = 1 - Math.exp(-rate * delta);
  current.lerp(target, factor);
}

/**
 * Owns all camera behavior, and ONLY camera behavior — no other component in this scene ever
 * touches `camera.position` or `controls.target`. Three distinct, mutually-exclusive states:
 *
 *   1. Intro fly-in (once, on mount): position lerps from a further/offset start to the resting
 *      pose over ~2s, ease-out.
 *   2. Idle: OrbitControls owns the camera completely — this rig does not touch
 *      camera.position/controls.target at all (only calls `controls.update()`, which
 *      `enableDamping` requires every frame for its own inertia to work). This is the fix for
 *      the reported "camera snaps back" bug: the previous version unconditionally eased
 *      camera.position/controls.target toward a "desired" pose *every frame, forever* — when
 *      idle, that desired pose was the rest pose, so the camera was continuously (if slowly)
 *      dragged back to rest even while the user was actively orbiting it away, and kept being
 *      pulled back afterward. There was no "idle" state at all; the rig always thought it
 *      should be easing somewhere.
 *   3. Animating (only while transitioning to a newly-focused node, or to the rest pose after
 *      "Reset View" is pressed): eases toward a one-shot destination and *stops* — flips back to
 *      idle — the instant it arrives (see ARRIVAL_EPSILON_SQ), or the instant the user grabs the
 *      camera mid-flight (`onStart` cancels it immediately, matching "once the user manually
 *      interacts, the camera stays exactly where they leave it").
 */
export function CameraRig({ restPosition, restTarget, introStartPosition, focusPosition, focusKey, resetSignal }: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const introElapsed = useRef(0);
  const introDone = useRef(false);
  const isAnimating = useRef(false);

  const animDestinationPosition = useRef(restPosition.clone());
  const animDestinationTarget = useRef(restTarget.clone());

  const previousFocusKey = useRef<ArchComponentId | null>(null);
  const isFirstResetSignal = useRef(true);

  useEffect(() => {
    camera.position.copy(introStartPosition);
    // Intro start position is only ever read once, at mount.
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
      animDestinationPosition.current = focusPosition.clone().add(viewDirection.normalize().multiplyScalar(viewDistance));
      animDestinationTarget.current = focusPosition.clone();
      isAnimating.current = true;
    }
    previousFocusKey.current = focusKey;
  }, [focusKey, focusPosition, restTarget, camera]);

  // Trigger #2: the "Reset View" button. Skips the mount-time invocation (resetSignal starts at
  // 0 and hasn't been "pressed" yet) so this never fires on its own.
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }
    animDestinationPosition.current = restPosition.clone();
    animDestinationTarget.current = restTarget.clone();
    isAnimating.current = true;
  }, [resetSignal, restPosition, restTarget]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;

    if (!introDone.current) {
      introElapsed.current += delta;
      const raw = Math.min(introElapsed.current / INTRO_DURATION, 1);
      const eased = 1 - (1 - raw) ** 3;
      camera.position.lerpVectors(introStartPosition, restPosition, eased);
      // Only the camera position flies in during the intro — the look-at target stays fixed
      // at rest throughout so the whole move reads as "pulling back into place", not a pan.
      if (controls) controls.target.copy(restTarget);
      if (raw >= 1) introDone.current = true;
    } else if (isAnimating.current) {
      easeTowards(camera.position, animDestinationPosition.current, delta, FOCUS_EASE_RATE);
      if (controls) easeTowards(controls.target, animDestinationTarget.current, delta, FOCUS_EASE_RATE);

      const positionRemaining = camera.position.distanceToSquared(animDestinationPosition.current);
      const targetRemaining = controls ? controls.target.distanceToSquared(animDestinationTarget.current) : 0;
      if (positionRemaining < ARRIVAL_EPSILON_SQ && targetRemaining < ARRIVAL_EPSILON_SQ) {
        camera.position.copy(animDestinationPosition.current);
        if (controls) controls.target.copy(animDestinationTarget.current);
        isAnimating.current = false;
      }
    }
    // Idle (neither introing nor animating): deliberately no camera.position/controls.target
    // writes at all — OrbitControls owns them entirely from here.

    controls?.update();
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
        // The user grabbed the camera — if a fly-to-node/reset animation was in flight, it must
        // stop immediately rather than keep fighting their drag/zoom/pan.
        isAnimating.current = false;
      }}
    />
  );
}
