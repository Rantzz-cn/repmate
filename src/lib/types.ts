export type Muscle = "chest" | "back" | "shoulders" | "triceps" | "biceps" | "quadriceps" | "hamstrings" | "glutes" | "calves" | "core";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: string;
  type: "compound" | "isolation";
  rest: number;
  repRange: string;
  animation: string;
  favorite?: boolean;
}

export interface RoutineExercise { exerciseId: string; sets: number; minReps: number; maxReps: number }
export interface Routine { id: string; name: string; muscles: string[]; weekday: number; exercises: RoutineExercise[] }
export interface Program { id: string; name: string; split: string; active: boolean; days: Routine[] }
export interface WorkoutSet { weight: number; reps: number; rir: number; done: boolean }
export interface WorkoutExercise { exerciseId: string; sets: WorkoutSet[]; rest: number; minReps: number; maxReps: number }
export interface Workout { id: string; sessionId: string; programId: string; dayId: string; name: string; startedAt: string; completedAt?: string; duration?: number; current: number; exercises: WorkoutExercise[]; photo?: string | null }
export interface Profile { id: "me"; name: string; goal: string; units: "kg" | "lb"; avatarUrl?: string; starterProgramInitialized?: boolean; theme?: "dark" | "light"; notifications?: boolean; vibration?: boolean; onboardingComplete?: boolean; experience?: "beginner" | "intermediate" | "advanced"; trainingDays?: number[]; trainingSetup?: "gym" | "home" | "bodyweight" }
export type StoreName = "programs" | "workouts" | "activeWorkout" | "profile" | "recovery";
