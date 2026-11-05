import { shot, burst, charge, spinup, variants } from './discrete.js';
import { beam, flame } from './continuous.js';
import { lob, rain, chain } from './ground.js';
import { deploy, orbit } from './summon.js';

/** Todos os modos de disparo. Interface: { hold(world, p, w, dt), idle?(world, p, w, dt), release?(world, p, w) } */
export const MODES = {
  shot, burst, charge, spinup, variants, beam, flame, lob, rain, chain, deploy, orbit,
  split: shot,        // o projétil se divide ao bater (shots.js põe "split" no projétil)
  singularity: shot   // o projétil vira buraco negro ao bater
};
