import { CourseTemplate, Interview, Student } from './nexview-types';

export const DEFAULT_COURSE_TEMPLATES: Record<string, CourseTemplate> = {
  'Full Stack Development': {
    course: 'Full Stack Development',
    showProblemSolving: true,
    categories: [
      {
        id: 'html_css',
        label: 'HTML & CSS',
        suggestions: [
          'Semantic HTML elements & accessibility (a11y)',
          'CSS Flexbox vs CSS Grid use-cases',
          'CSS Specificity, Inheritance and Box Model',
          'Responsive design principles & media queries (Mobile-first)',
          'CSS Units: rem, em, vh, vw differences',
        ],
      },
      {
        id: 'javascript_ts',
        label: 'JavaScript & TypeScript',
        suggestions: [
          'Closures and lexical scoping in JavaScript',
          'Event Loop: Call Stack, Callback Queue, Microtask Queue',
          'Promises, Async/Await and Promise.all vs allSettled',
          'var, let, const: Scope, Hoisting and Temporal Dead Zone',
          'TypeScript: Type vs Interface and Generics',
          'Array methods: map, filter, reduce (Mutating vs Non-mutating)',
        ],
      },
      {
        id: 'react_next',
        label: 'React & Next.js',
        suggestions: [
          'Virtual DOM and React reconciliation algorithm',
          'useEffect lifecycle, dependency array & cleanup functions',
          'Custom Hooks: When and how to create them',
          'Next.js: Server Components vs Client Components',
          'Next.js Rendering: SSR, SSG, ISR and Client-side fetch',
          'State Management: Context API vs Redux Toolkit vs Zustand',
        ],
      },
      {
        id: 'node_express',
        label: 'Node.js & Express',
        suggestions: [
          'Express.js Middleware execution order and next()',
          'RESTful API design best practices & status codes',
          'Authentication: JWT vs Session cookies & Token Refresh flow',
          'Global error handling middleware in Express',
          'Node.js Event-driven architecture and Streams',
        ],
      },
      {
        id: 'database',
        label: 'Database & MongoDB',
        suggestions: [
          'Indexing in MongoDB: Why and how it improves query speed',
          'MongoDB Aggregation Pipeline ($match, $group, $lookup)',
          'SQL vs NoSQL: ACID properties vs BASE model',
          'Database Relationships: Embedding vs Referencing',
        ],
      },
    ],
  },
  'Frontend Development': {
    course: 'Frontend Development',
    showProblemSolving: true,
    categories: [
      {
        id: 'html_css',
        label: 'HTML5, CSS3 & Tailwind',
        suggestions: [
          'Modern Semantic HTML5 tags and SEO best practices',
          'Tailwind CSS utility classes & custom configuration',
          'CSS Animations & Transitions',
          'Responsive layouts for mobile, tablet, and widescreen',
        ],
      },
      {
        id: 'js_es6',
        label: 'Core JavaScript & ES6+',
        suggestions: [
          'Destructuring, Rest/Spread operators, Optional chaining',
          'Arrow functions vs Regular functions (this binding)',
          'Asynchronous JS & fetch API error handling',
          'DOM Manipulation and Event Bubbling/Capturing',
        ],
      },
      {
        id: 'react_ecosystem',
        label: 'React & Component Architecture',
        suggestions: [
          'Component composition and Props drilling avoidance',
          'useMemo, useCallback and React.memo optimization',
          'Form handling: Controlled vs Uncontrolled components',
          'API data fetching with TanStack Query (React Query)',
        ],
      },
    ],
  },
};

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_INTERVIEWS: Interview[] = [];
