import { Student, Interview } from './nexview-types';
import { INITIAL_STUDENTS, INITIAL_INTERVIEWS } from './default-templates';

// In-memory cache store for active server runtime
let studentsCache: Student[] = [...INITIAL_STUDENTS];
let interviewsCache: Interview[] = [...INITIAL_INTERVIEWS];

export function getCachedNexViewData() {
  return { students: studentsCache, interviews: interviewsCache };
}

export function updateCachedNexViewData(students: Student[], interviews: Interview[]) {
  studentsCache = students;
  interviewsCache = interviews;
}
