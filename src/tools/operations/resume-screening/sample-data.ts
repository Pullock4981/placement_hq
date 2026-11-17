/**
 * Sample Presets for Testing & Demonstrating Resume Screening
 */

import { BatchCandidateRow } from './types';

export const SAMPLE_JOB_DESCRIPTIONS = [
  {
    id: 'mern-dev',
    title: 'MERN Stack Developer (Frontend Heavy)',
    minExperience: 1,
    mustHave: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Tailwind CSS'],
    niceToHave: ['Redux', 'MongoDB', 'Docker', 'REST API'],
    jdText: `We are looking for a skilled MERN Stack Developer with strong React and Next.js experience.
Requirements:
- Must have solid experience with React, Next.js, and TypeScript.
- Strong knowledge of Node.js and Tailwind CSS for responsive UI development.
- Hands-on experience building REST APIs with Express and MongoDB.
- Experience with Docker, Redux Toolkit, and Git workflow is a big plus.
- Minimum 1+ years of professional or strong internship/project experience.`,
  },
  {
    id: 'backend-node',
    title: 'Backend Node.js & Database Engineer',
    minExperience: 2,
    mustHave: ['Node.js', 'Express.js', 'PostgreSQL', 'REST API', 'Docker'],
    niceToHave: ['GraphQL', 'AWS', 'Redis', 'CI/CD'],
    jdText: `Senior Backend Engineer needed to build resilient microservices.
Must have deep expertise in Node.js, Express.js, PostgreSQL, and Docker.
Familiarity with GraphQL, Redis caching, AWS, and CI/CD pipelines preferred.
Requires at least 2 years of backend production experience.`,
  },
];

export const SAMPLE_RESUMES = {
  strongCandidate: `Tanvir Ahmed
Dhaka, Bangladesh | tanvir.dev@gmail.com | +8801712345678 | github.com/tanvir-dev | linkedin.com/in/tanvir-ahmed

PROFESSIONAL SUMMARY
Passionate Full-Stack Developer with 2+ years of hands-on experience building high-performance web applications using React, Next.js, TypeScript, and Node.js.

WORK EXPERIENCE
Frontend Engineer | TechNex Solutions | Jan 2022 - Present
- Engineered high-traffic responsive web applications using Next.js, React.js, and TypeScript.
- Styled modern interfaces with Tailwind CSS and managed complex global state with Redux Toolkit.
- Collaborated with backend engineers to integrate RESTful APIs and optimized client-side performance.
- Containerized local development environments using Docker and maintained automated Git workflows.

KEY PROJECTS
1. PlacementHQ Dashboard (Next.js, TypeScript, Tailwind CSS, Node.js, MongoDB)
   - Built a comprehensive dashboard for placement tracking and candidate screening.
   - Deployed REST APIs using Node.js and Express with MongoDB database.
2. E-Commerce Multi-Vendor Platform (React, Redux, REST API)
   - Created full-stack storefront featuring cart, checkout, and auth.

TECHNICAL SKILLS
- Languages: JavaScript (ES6+), TypeScript, HTML5, CSS3
- Frontend: React.js, Next.js, Tailwind CSS, Redux Toolkit
- Backend & DB: Node.js, Express.js, REST API, MongoDB, PostgreSQL
- Tools: Docker, Git, GitHub Actions, Postman`,

  moderateCandidate: `Rashedul Islam
Dhaka, Bangladesh | rashed.dev@hotmail.com | +8801812345678 | github.com/rashedul-dev

CAREER OBJECTIVE
Enthusiastic Junior Developer seeking to contribute front-end skills to high-impact software teams.

EXPERIENCE
Junior Web Developer | CodeLab BD | June 2023 - Present
- Developed UI components using React and JavaScript.
- Utilized Tailwind CSS for styling and Git for version control.
- Consumed REST APIs and assisted in Express backend maintenance.

PROJECTS
- Blog CMS: Built using React, Node.js, and MongoDB.
- Portfolio: Styled with Tailwind CSS and responsive design.

SKILLS
- JavaScript, React, HTML, CSS, Tailwind CSS
- Node.js, Express, MongoDB, REST API
- Redux, Git, GitHub workflow`,

  mismatchCandidate: `Mahmudul Hasan
Chittagong, Bangladesh | mahmudul.art@gmail.com

SUMMARY
Passionate Game and Mobile App Creator specializing in Flutter, Dart, and Unreal Engine 5.

EXPERIENCE
Freelance Game Developer | 2022 - 2023
- Built mobile 2D games using Flutter and Dart.
- Scripted 3D environments in Unreal Engine using C++.
- Created WordPress websites for local businesses.

TECHNICAL SKILLS
- Flutter, Dart, Unreal Engine, Unity, C++, WordPress, PHP`,
};

export const SAMPLE_BATCH_CANDIDATES: BatchCandidateRow[] = [
  {
    id: 'c1',
    name: 'Tanvir Ahmed',
    batch: 'Batch 10 - Web',
    resumeInput: SAMPLE_RESUMES.strongCandidate,
  },
  {
    id: 'c2',
    name: 'Rashedul Islam',
    batch: 'Batch 10 - Web',
    resumeInput: SAMPLE_RESUMES.moderateCandidate,
  },
  {
    id: 'c3',
    name: 'Mahmudul Hasan',
    batch: 'Batch 9 - App Dev',
    resumeInput: SAMPLE_RESUMES.mismatchCandidate,
  },
  {
    id: 'c4',
    name: 'Farhana Sultana',
    batch: 'Batch 10 - Web',
    resumeInput: `Farhana Sultana | farhana.code@gmail.com | +8801912345678 | github.com/farhana-s
Full-stack software developer with 1.5 years experience.
Experienced in Next.js, React, TypeScript, Node.js, Express, Tailwind CSS, and MongoDB.
Built 4 production web apps with secure REST APIs and Docker containers.`,
  },
  {
    id: 'c5',
    name: 'Arefin Shuvo',
    batch: 'Batch 8 - Web',
    resumeInput: `Arefin Shuvo | arefin@shuvo.com | +8801612345678
Frontend Developer (React, Tailwind CSS, JavaScript).
1 year experience building UI templates and responsive landing pages. Missing Next.js and TypeScript production background.`,
  },
];

