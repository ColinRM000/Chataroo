import React, { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'

interface ModerationPanelProps {
  userId: number
  username: string
  broadcasterUserId: number
  currentAccentColor: string
  onClose: () => void
  onActionComplete?: (action: string) => void
}

interface TimeoutOption {
  label: string
  minutes: number
}

const TIMEOUT_OPTIONS: TimeoutOption[] = [
  { label: '1 min', minutes: 1 },
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
]

export const ModerationPanel: React.FC<ModerationPanelProps> = ({
  userId,
  username,
  broadcasterUserId,
  currentAccentColor,
  onClose,
  onActionComplete,
}) => {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    confirmColor: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmColor: '',
    onConfirm: () => {}
  })

  const handleTimeout = (minutes: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Timeout User',
      message: `Timeout ${username} for ${minutes} minute${minutes === 1 ? '' : 's'}?`,
      confirmText: 'Timeout',
      confirmColor: '#ffa500',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
          const result = await window.chatarooAPI.timeoutUser({
            broadcasterUserId,
            userId,
            durationMinutes: minutes,
            reason: reason || undefined,
          })

          if (result.success) {
            setSuccess(`Successfully timed out ${username} for ${minutes} minute${minutes === 1 ? '' : 's'}`)
            onActionComplete?.('timeout')

            // Auto-close after success
            setTimeout(() => {
              onClose()
            }, 2000)
          } else {
            setError(result.error || 'Failed to timeout user')
          }
        } catch (err: any) {
          setError(err.message || 'Failed to timeout user')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleBan = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Ban User',
      message: `Permanently ban ${username}? This action requires manual unbanning.`,
      confirmText: 'Ban',
      confirmColor: '#dc3545',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
          const result = await window.chatarooAPI.banUser({
            broadcasterUserId,
            userId,
            reason: reason || undefined,
          })

          if (result.success) {
            setSuccess(`Successfully banned ${username}`)
            onActionComplete?.('ban')

            // Auto-close after success
            setTimeout(() => {
              onClose()
            }, 2000)
          } else {
            setError(result.error || 'Failed to ban user')
          }
        } catch (err: any) {
          setError(err.message || 'Failed to ban user')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUnban = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Ban',
      message: `Remove ban/timeout for ${username}?`,
      confirmText: 'Unban',
      confirmColor: '#28a745',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
          const result = await window.chatarooAPI.unbanUser({
            broadcasterUserId,
            userId,
          })

          if (result.success) {
            setSuccess(`Successfully unbanned ${username}`)
            onActionComplete?.('unban')

            // Auto-close after success
            setTimeout(() => {
              onClose()
            }, 2000)
          } else {
            setError(result.error || 'Failed to unban user')
          }
        } catch (err: any) {
          setError(err.message || 'Failed to unban user')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px',
      border: '1px solid #444'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#fff', fontSize: '14px', fontWeight: 600 }}>
          🛡️ Moderate {username}
        </h4>
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '20px',
            cursor: 'pointer',
            padding: 0,
            width: '24px',
            height: '24px',
          }}
        >
          ×
        </button>
      </div>

      {/* Reason Input */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#aaa' }}>
          Reason (optional, max 100 chars)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 100))}
          maxLength={100}
          placeholder="e.g., Spam, harassment, etc."
          disabled={loading}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px',
          }}
        />
        <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '11px' }}>
          {reason.length}/100 characters
        </small>
      </div>

      {/* Timeout Options */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px', fontWeight: 600 }}>
          Timeout Duration
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px'
        }}>
          {TIMEOUT_OPTIONS.map((option) => (
            <button
              key={option.minutes}
              onClick={() => handleTimeout(option.minutes)}
              disabled={loading}
              style={{
                padding: '8px 4px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                opacity: loading ? 0.5 : 1,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3a3a3a')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2a2a2a')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ban/Unban Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={handleBan}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: '#dc3545',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = '1')}
        >
          Permanent Ban
        </button>
        <button
          onClick={handleUnban}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: '#28a745',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = '1')}
        >
          Remove Ban
        </button>
      </div>

      {/* Status Messages */}
      {loading && (
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          backgroundColor: '#1e3a5f',
          color: '#64b5f6',
        }}>
          Processing...
        </div>
      )}
      {error && (
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          backgroundColor: '#5f1e1e',
          color: '#ff6b6b',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          backgroundColor: '#1e5f3a',
          color: '#4caf50',
        }}>
          {success}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
