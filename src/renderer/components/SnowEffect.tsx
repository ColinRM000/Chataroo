import React, { useMemo, memo } from 'react'
import './SnowEffect.css'

// Memoized to prevent re-renders from disrupting CSS animations
export const SnowEffect: React.FC = memo(() => {
  // Generate 50 snowflakes with random properties - memoized so they don't regenerate on every render
  const snowflakes = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => {
      const leftPosition = Math.random() * 100 // Random position from 0-100%
      const animationDuration = 5 + Math.random() * 10 // Random duration between 5-15s
      const animationDelay = Math.random() * 5 // Random delay between 0-5s
      const size = 2 + Math.random() * 4 // Random size between 2-6px
      const opacity = 0.3 + Math.random() * 0.7 // Random opacity between 0.3-1.0

      return (
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${leftPosition}%`,
            animationDuration: `${animationDuration}s`,
            animationDelay: `${animationDelay}s`,
            width: `${size}px`,
            height: `${size}px`,
            opacity: opacity
          }}
        />
      )
    })
  }, []) // Empty dependency array - only generate once

  return (
    <div className="snow-container">
      {snowflakes}
    </div>
  )
})
