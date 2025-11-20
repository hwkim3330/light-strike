
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HandType, COLORS } from '../types';

interface SaberProps {
  type: HandType;
  positionRef: React.MutableRefObject<THREE.Vector3 | null>;
  velocityRef: React.MutableRefObject<THREE.Vector3 | null>;
}

const Saber: React.FC<SaberProps> = ({ type, positionRef, velocityRef }) => {
  const meshRef = useRef<THREE.Group>(null);
  const saberLength = 1.0; 

  const targetRotation = useRef(new THREE.Euler());

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const targetPos = positionRef.current;
    const velocity = velocityRef.current;

    if (targetPos) {
      meshRef.current.visible = true;
      meshRef.current.position.lerp(targetPos, 0.5); 
      
      // Resting pose
      const restingX = -Math.PI / 3.5; 
      const restingY = 0;
      const restingZ = type === 'left' ? 0.2 : -0.2; 

      let swayX = 0;
      let swayY = 0;
      let swayZ = 0;

      if (velocity) {
          swayX = velocity.y * 0.05; 
          swayZ = -velocity.x * 0.05;
          swayX += velocity.z * 0.02;
      }

      targetRotation.current.set(
          restingX + swayX,
          restingY + swayY,
          restingZ + swayZ
      );

      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotation.current.x, 0.2);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation.current.y, 0.2);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotation.current.z, 0.2);

    } else {
      meshRef.current.visible = false;
    }
  });

  const color = type === 'left' ? COLORS.left : COLORS.right;

  return (
    <group ref={meshRef}>
      {/* --- MAGIC WAND HANDLE --- */}
      {/* Main Handle (White) */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.14, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
      </mesh>
      
      {/* Pommel (Gold/Silver accent) */}
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Guard (Gold/Silver accent) */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.025, 0.015, 0.02, 16]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
      </mesh>


      {/* --- GLOWING TIP --- */}
      {/* Solid Color Core */}
      <mesh position={[0, 0.02 + saberLength / 2, 0]}>
        <capsuleGeometry args={[0.015, saberLength, 16, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Translucent Outer Glow (for soft edge) */}
      <mesh position={[0, 0.02 + saberLength / 2, 0]}>
        <capsuleGeometry args={[0.03, saberLength, 16, 32]} />
        <meshBasicMaterial 
          color={color} 
          transparent
          opacity={0.4} 
          toneMapped={false}
        />
      </mesh>
      
      {/* Light */}
      <pointLight color={color} intensity={1.2} distance={2} decay={2} position={[0, 0.5, 0]} />
    </group>
  );
};

export default Saber;
