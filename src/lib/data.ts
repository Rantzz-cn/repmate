import type { Exercise, Muscle, Profile, Program } from "./types";

const source: Array<[string, Muscle, string, "compound" | "isolation", number, Muscle[]]> = [
  ["Barbell Bench Press","chest","barbell","compound",180,["shoulders","triceps"]],
  ["Incline Dumbbell Press","chest","dumbbell","compound",180,["shoulders","triceps"]],
  ["Cable Middle Fly","chest","cable","isolation",60,["shoulders"]],
  ["Push-Up","chest","bodyweight","compound",90,["shoulders","triceps"]],
  ["Lever Chest Press","chest","machine","compound",120,["shoulders","triceps"]],
  ["Lat Pulldown","back","cable","compound",120,["biceps"]],
  ["Assisted Pull-Up","back","machine","compound",120,["biceps"]],
  ["Cable Seated Row","back","cable","compound",120,["biceps","shoulders"]],
  ["Chest-Supported Row","back","dumbbell","compound",120,["biceps","shoulders"]],
  ["Lever High Row","back","machine","compound",120,["biceps","shoulders"]],
  ["Cable Pullover","back","cable","isolation",60,["chest","triceps"]],
  ["Machine Shoulder Press","shoulders","machine","compound",120,["triceps"]],
  ["Dumbbell Shoulder Press","shoulders","dumbbell","compound",120,["triceps"]],
  ["Cable Lateral Raise","shoulders","cable","isolation",60,["back"]],
  ["Dumbbell Lateral Raise","shoulders","dumbbell","isolation",60,["back"]],
  ["Face Pull","shoulders","cable","isolation",60,["back"]],
  ["Triceps Pushdown","triceps","cable","isolation",60,[]],
  ["Overhead Triceps Extension","triceps","cable","isolation",60,[]],
  ["Close-Grip Bench Press","triceps","barbell","compound",180,["chest","shoulders"]],
  ["Dumbbell Biceps Curl","biceps","dumbbell","isolation",60,[]],
  ["Cable Curl","biceps","cable","isolation",60,[]],
  ["Hammer Curl","biceps","dumbbell","isolation",60,[]],
  ["Barbell Full Squat","quadriceps","barbell","compound",180,["glutes","hamstrings","core"]],
  ["Leg Press","quadriceps","machine","compound",120,["glutes","hamstrings"]],
  ["Leg Extension","quadriceps","machine","isolation",60,[]],
  ["Romanian Deadlift","hamstrings","barbell","compound",180,["glutes","back","core"]],
  ["Leg Curl","hamstrings","machine","isolation",60,["calves"]],
  ["Barbell Glute Bridge","glutes","barbell","compound",180,["hamstrings","core"]],
  ["Dumbbell Single-Leg Split Squat","glutes","dumbbell","compound",120,["quadriceps","hamstrings"]],
  ["Standing Calf Raise","calves","machine","isolation",60,[]],
  ["Seated Calf Raise","calves","machine","isolation",60,[]],
  ["Cable Kneeling Crunch","core","cable","isolation",60,[]],
  ["Plank","core","bodyweight","isolation",60,["shoulders","glutes"]],
  ["Hanging Leg Raise","core","bodyweight","isolation",60,["quadriceps"]],
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const exercises: Exercise[] = source.map(([name, primaryMuscle, equipment, type, rest, secondaryMuscles], index) => ({
  id: `ex-${index + 1}`, name, primaryMuscle, secondaryMuscles, equipment, type, rest,
  repRange: type === "compound" ? "6 to 10" : "10 to 15",
  animation: `/assets/animations/${slug(name)}.gif`,
}));

const id = (name: string) => exercises.find((exercise) => exercise.name === name)!.id;
const routine = (routineId: string, name: string, weekday: number, muscles: string[], names: string[]) => ({
  id: routineId, name, weekday, muscles,
  exercises: names.map((name) => ({ exerciseId: id(name), sets: 3, minReps: 8, maxReps: 12 })),
});

export const starterProgram: Program = {
  id: "starter-ppl", name: "Starter PPL", split: "Push Pull Legs", active: true,
  days: [
    routine("starter-push","Push",1,["Chest","Shoulders","Triceps"],["Barbell Bench Press","Incline Dumbbell Press","Machine Shoulder Press","Cable Lateral Raise","Triceps Pushdown"]),
    routine("starter-pull","Pull",3,["Back","Biceps"],["Lat Pulldown","Cable Seated Row","Chest-Supported Row","Face Pull","Dumbbell Biceps Curl"]),
    routine("starter-legs","Legs",5,["Quadriceps","Hamstrings","Glutes","Calves"],["Barbell Full Squat","Romanian Deadlift","Leg Press","Leg Curl","Standing Calf Raise"]),
  ],
};

export interface OnboardingPreferences { goal: string; experience: "beginner" | "intermediate" | "advanced"; days: number[]; setup: "gym" | "home" | "bodyweight" }

export function buildStarterProgram(preferences: OnboardingPreferences): Program {
  const gym = {
    Push: ["Barbell Bench Press", "Incline Dumbbell Press", "Machine Shoulder Press", "Cable Lateral Raise", "Triceps Pushdown"],
    Pull: ["Lat Pulldown", "Cable Seated Row", "Chest-Supported Row", "Face Pull", "Dumbbell Biceps Curl"],
    Legs: ["Barbell Full Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Standing Calf Raise"],
  };
  const home = {
    Push: ["Push-Up", "Incline Dumbbell Press", "Dumbbell Shoulder Press", "Dumbbell Lateral Raise", "Close-Grip Bench Press"],
    Pull: ["Chest-Supported Row", "Dumbbell Biceps Curl", "Hammer Curl", "Dumbbell Lateral Raise"],
    Legs: ["Dumbbell Single-Leg Split Squat", "Romanian Deadlift", "Barbell Glute Bridge", "Standing Calf Raise", "Plank"],
  };
  const bodyweight = {
    Push: ["Push-Up", "Plank"],
    Pull: ["Hanging Leg Raise", "Plank"],
    Legs: ["Hanging Leg Raise", "Plank", "Push-Up"],
  };
  const templates = preferences.setup === "gym" ? gym : preferences.setup === "home" ? home : bodyweight;
  const sets = preferences.experience === "beginner" ? 2 : preferences.experience === "advanced" ? 4 : 3;
  const selectedDays = [...preferences.days].sort((a, b) => a - b);
  const sequence = ["Push", "Pull", "Legs"] as const;
  const routines = selectedDays.map((weekday, index) => {
    const label = sequence[index % sequence.length];
    const fullBodyNames = index === 0
      ? [templates.Push[0], templates.Pull[0], templates.Legs[0], templates.Push[1], templates.Legs[1]]
      : [templates.Legs[0], templates.Pull[1], templates.Push[0], templates.Legs[1], templates.Pull[0]];
    const names = selectedDays.length === 2 ? [...new Set(fullBodyNames.filter(Boolean))] : templates[label];
    const targets = label === "Push" ? ["Chest", "Shoulders", "Triceps"] : label === "Pull" ? ["Back", "Biceps"] : ["Quadriceps", "Hamstrings", "Glutes", "Core"];
    return {
      id: `onboarding-${label.toLowerCase()}-${index + 1}`,
      name: selectedDays.length === 2 ? `Full Body ${index ? "B" : "A"}` : label,
      weekday,
      muscles: selectedDays.length === 2 ? ["Full Body"] : targets,
      exercises: names.map((name) => {
        const exercise = exercises.find((item) => item.name === name)!;
        const strength = preferences.goal === "Get stronger" && exercise.type === "compound";
        return { exerciseId: exercise.id, sets, minReps: strength ? 5 : 8, maxReps: strength ? 8 : 12 };
      }),
    };
  });
  return { id: "starter-personalized", name: preferences.goal === "Get stronger" ? "Strength Starter" : "RepMate Starter", split: selectedDays.length === 2 ? "Full Body" : "Push Pull Legs", active: true, days: routines };
}

export const defaultProfile: Profile = { id: "me", name: "RepMate Member", goal: "Build muscle", units: "kg", theme: "dark", notifications: false, vibration: true, onboardingComplete: false };
export const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
