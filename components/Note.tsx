
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useMemo, useRef } from 'react';
import { Extrude, Box } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NoteData, COLORS } from '../types';
import { LANE_X_POSITIONS, LAYER_Y_POSITIONS, NOTE_SIZE } from '../constants';

interface NoteProps {
  data: NoteData;
  zPos: number;
  currentTime: number;
}

// --- STAR SHAPE (Rounder, cuter) ---
const createSparkShape = (size: number) => {
  const shape = new THREE.Shape();
  const s = size / 1.6; 

  shape.moveTo(0, s);
  shape.quadraticCurveTo(s*0.2, s*0.2, s, 0);
  shape.quadraticCurveTo(s*0.2, -s*0.2, 0, -s);
  shape.quadraticCurveTo(-s*0.2, -s*0.2, -s, 0);
  shape.quadraticCurveTo(-s*0.2, s*0.2, 0, s);
  
  return shape;
};

const SPARK_SHAPE = createSparkShape(NOTE_SIZE);
const EXTRUDE_SETTINGS = { depth: NOTE_SIZE * 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 8 };

const Debris: React.FC<{ data: NoteData, timeSinceHit: number, color: string }> = ({ data, timeSinceHit, color }) => {
    const groupRef = useRef<THREE.Group>(null);
    
    const flySpeed = 5.0;
    const rotationSpeed = 8.0;
    const distance = flySpeed * timeSinceHit;

    useFrame(() => {
        if (groupRef.current) {
             // Fade out
             groupRef.current.scale.setScalar(Math.max(0.01, 1 - timeSinceHit * 2));
        }
    });
    
    // Confetti Cubes
    const Particle = ({ offsetDir, moveDir }: { offsetDir: number[], moveDir: number[] }) => {
        const meshRef = useRef<THREE.Mesh>(null);

        useFrame(() => {
             if (meshRef.current) {
                 meshRef.current.position.x = offsetDir[0] + moveDir[0] * distance;
                 meshRef.current.position.y = offsetDir[1] + moveDir[1] * distance;
                 meshRef.current.position.z = offsetDir[2] + moveDir[2] * distance;

                 meshRef.current.rotation.x += moveDir[1] * rotationSpeed * 0.1;
                 meshRef.current.rotation.y += moveDir[0] * rotationSpeed * 0.1;
             }
        });

        return (
            <Box ref={meshRef} args={[0.12, 0.12, 0.12]} position={[offsetDir[0], offsetDir[1], offsetDir[2]]}>
                 <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </Box>
        )
    }

    return (
        <group ref={groupRef}>
            <Particle offsetDir={[0, 0.2, 0]} moveDir={[0, 1, -0.5]} />
            <Particle offsetDir={[0.2, 0, 0]} moveDir={[1, 0.2, -0.5]} />
            <Particle offsetDir={[0, -0.2, 0]} moveDir={[0, -1, -0.5]} />
            <Particle offsetDir={[-0.2, 0, 0]} moveDir={[-1, -0.2, -0.5]} />
            <Particle offsetDir={[0.1, 0.1, 0.1]} moveDir={[0.5, 0.5, 1]} />
            <Particle offsetDir={[-0.1, -0.1, -0.1]} moveDir={[-0.5, -0.5, 1]} />
        </group>
    );
};

const Note: React.FC<NoteProps> = ({ data, zPos, currentTime }) => {
  const color = data.type === 'left' ? COLORS.left : COLORS.right;
  
  const position: [number, number, number] = useMemo(() => {
     return [
         LANE_X_POSITIONS[data.lineIndex],
         LAYER_Y_POSITIONS[data.lineLayer],
         zPos
     ];
  }, [data.lineIndex, data.lineLayer, zPos]);

  if (data.missed) return null;

  if (data.hit && data.hitTime) {
      return (
          <group position={position}>
              <Debris data={data} timeSinceHit={currentTime - data.hitTime} color={color} />
          </group>
      );
  }

  return (
    <group position={position}>
      {/* Main Candy Shape */}
      <group position={[0, 0, -NOTE_SIZE * 0.25]}>
            <Extrude args={[SPARK_SHAPE, EXTRUDE_SETTINGS]} castShadow receiveShadow>
                <meshPhysicalMaterial 
                    color={color} 
                    roughness={0.1} 
                    metalness={0.1}
                    transmission={0.2}
                    thickness={2.0} // Thick glossy jelly
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    emissive={color}
                    emissiveIntensity={0.5} 
                />
            </Extrude>
      </group>
      
      {/* White center dot for aiming */}
      <mesh position={[0, 0, NOTE_SIZE * 0.3]}>
         <sphereGeometry args={[NOTE_SIZE * 0.15, 16, 16]} />
         <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
};

export default React.memo(Note, (prev, next) => {
    if (next.data.hit) return false;
    return prev.zPos === next.zPos && prev.data.hit === next.data.hit && prev.data.missed === next.data.missed;
});
