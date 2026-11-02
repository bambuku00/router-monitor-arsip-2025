import { describe, it, expect } from 'vitest'
import { formatBytes, formatKiloBytes, isValidUsername, isValidPassword } from '@/lib/utils'

describe('utils', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1234)).toBe('1.21 KB')
      expect(formatBytes(1048576)).toBe('1 MB')
    })

    it('should handle string input', () => {
      expect(formatBytes('1024')).toBe('1 KB')
    })

    it('should handle 0 input', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes('0')).toBe('0 Bytes')
    })
  })

  describe('formatKiloBytes', () => {
    it('should format kilobytes correctly', () => {
      expect(formatKiloBytes(1)).toBe('1 KB') // 1024 bytes
      expect(formatKiloBytes(1024)).toBe('1 MB') // 1024 * 1024 bytes
    })
  })

  describe('isValidUsername', () => {
    it('should return true for valid usernames', () => {
      expect(isValidUsername('user123')).toBe(true)
      expect(isValidUsername('test_user')).toBe(true)
      expect(isValidUsername('user-name')).toBe(true)
    })

    it('should return false for invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false) // Too short
      expect(isValidUsername('user@name')).toBe(false) // Invalid char
      expect(isValidUsername(123)).toBe(false) // Not a string
    })
  })

  describe('isValidPassword', () => {
    it('should return true for valid passwords', () => {
      expect(isValidPassword('password123')).toBe(true)
    })

    it('should return false for invalid passwords', () => {
      expect(isValidPassword('short')).toBe(false) // Too short (default min 8)
    })

    it('should respect custom lengths', () => {
      expect(isValidPassword('123', 3)).toBe(true)
      expect(isValidPassword('123456', 3, 5)).toBe(false) // Too long
    })
  })
})
