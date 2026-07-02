import { Filter } from 'lucide-react'
import clsx from 'clsx'

export default function CourseFilter({ courses, selected, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Filter:</span>
      </div>
      {/* Horizontal scroll on mobile, wrap on desktop */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide flex-nowrap md:flex-wrap">
        <button
          onClick={() => onChange(null)}
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
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
              'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
              selected === course
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {course}
          </button>
        ))}
      </div>
    </div>
  )
}
