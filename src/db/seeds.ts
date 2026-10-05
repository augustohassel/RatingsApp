import { Topic } from '../types';

export const INITIAL_TOPICS: Topic[] = [
  {
    id: 'topic-work',
    name: 'Trabajo / Laboral',
    description: 'Auto-evaluación del entorno, bienestar y satisfacción laboral.',
    color: '#6366f1', // Indigo
    icon: 'Briefcase',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: [
      {
        id: 'w-1',
        name: 'Relación con mi superior',
        explanation: 'Relación con el jefe directo / supervisores',
        defaultWeight: 8,
      },
      {
        id: 'w-2',
        name: 'Tareas que realizo',
        explanation: 'Me divierten o no me divierten las tareas del día a día',
        defaultWeight: 8,
      },
      {
        id: 'w-3',
        name: 'Compromiso con la visión de la organización',
        explanation: 'Grado de compromiso personal con los objetivos y el proyecto',
        defaultWeight: 2,
      },
      {
        id: 'w-4',
        name: 'Espacio físico de trabajo',
        explanation: 'Comodidad, equipamiento y ergonomía de la oficina o home office',
        defaultWeight: 4,
      },
      {
        id: 'w-5',
        name: 'Cultura de la organización',
        explanation: 'Cómo me identifico con los valores y dinámicas reales del equipo',
        defaultWeight: 6,
      },
      {
        id: 'w-6',
        name: 'Relación con mis compañeros',
        explanation: 'Vínculo y clima cotidiano con los compañeros de área',
        defaultWeight: 8,
      },
      {
        id: 'w-7',
        name: 'Relación con mis pares',
        explanation: 'Coordinación y sintonía con pares de mismo nivel / otros gerentes',
        defaultWeight: 9,
      },
      {
        id: 'w-8',
        name: 'Equipo generado',
        explanation: 'Calidad, motivación y sinergia del equipo a cargo o grupo de trabajo',
        defaultWeight: 9,
      },
      {
        id: 'w-9',
        name: 'Proyección dentro del puesto',
        explanation: 'Combinación entre la proyección real y la percibida de crecimiento',
        defaultWeight: 8,
      },
      {
        id: 'w-10',
        name: 'Aprendizaje contínuo',
        explanation: 'Desafíos intelectuales y adquisición de nuevas habilidades prácticas',
        defaultWeight: 5,
      },
      {
        id: 'w-11',
        name: 'Balance vida personal / laboral',
        explanation: 'Tiempo para familia, descanso y desconexión sin estrés excesivo',
        defaultWeight: 10,
      },
      {
        id: 'w-12',
        name: 'Movilidad casa / oficina',
        explanation: 'Tiempo y comodidad de traslados o flexibilidad de trabajo remoto',
        defaultWeight: 8,
      },
      {
        id: 'w-13',
        name: 'Salario',
        explanation: 'Compensación económica adecuada respecto a responsabilidades y mercado',
        defaultWeight: 9,
      },
      {
        id: 'w-14',
        name: 'Aprendizaje formal',
        explanation: 'Cursos, certificaciones, capacitaciones formales provistas o apoyadas',
        defaultWeight: 1,
      },
    ],
  },
  {
    id: 'topic-swimming',
    name: 'Natación / Deporte',
    description: 'Seguimiento de sensaciones, técnica y rendimiento deportivo.',
    color: '#06b6d4', // Cyan
    icon: 'Waves',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: [
      {
        id: 's-1',
        name: 'Sensación de energía y resistencia',
        explanation: 'Fuerza física y aire durante la sesión de entrenamiento',
        defaultWeight: 9,
      },
      {
        id: 's-2',
        name: 'Fluidez y técnica de nado',
        explanation: 'Sensación en brazada, patada y posición en el agua',
        defaultWeight: 8,
      },
      {
        id: 's-3',
        name: 'Constancia y cumplimiento del plan',
        explanation: 'Asistencia y metros/series completados',
        defaultWeight: 9,
      },
      {
        id: 's-4',
        name: 'Disfrute personal y desconexión',
        explanation: 'Cuánto disfruté el momento en el agua',
        defaultWeight: 10,
      },
      {
        id: 's-5',
        name: 'Recuperación física post-entreno',
        explanation: 'Ausencia de dolores o molestias articulares',
        defaultWeight: 7,
      },
    ],
  },
];
