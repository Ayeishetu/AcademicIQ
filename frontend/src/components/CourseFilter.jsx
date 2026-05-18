import { Filter } from 'lucide-react'
import clsx from 'clsx'

export default function CourseFilter({ courses, selected, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Filter className="w-3.5 h-3.5" />
        <span>Filter by course:</span>
      </div>
      <button
        onClick={() => onChange(null)}
        className={clsx(
          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
          !selected
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
      >
        All courses
      </button>
      {courses.map((course) => (
        <button
          key={course}
          onClick={() => onChange(course === selected ? null : course)}
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium transition-colors',
            selected === course
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {course}
        </button>
      ))}
    </div>
  )
}
