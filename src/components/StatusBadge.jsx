import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

const STATUS_CLS = {
  running:    'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400',
  starting:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  stopping:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  stopped:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sleeping:   'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
  installing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  error:      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

export default function StatusBadge({ status }) {
  const { t } = useTranslation()
  const cls = STATUS_CLS[status] || STATUS_CLS.stopped
  return (
    <span className={clsx('badge', cls)}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        status === 'running' ? 'bg-brand-500' :
        status === 'starting' || status === 'installing' ? 'bg-current pulse-dot' :
        status === 'error' ? 'bg-red-500' : 'bg-current'
      )} />
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  )
}
