// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Input, Textarea } from './input'

function Controlled({ onChange, ...props }: { onChange?: (value: string) => void; type?: string; required?: boolean }) {
  const [value, setValue] = useState('')
  return <Input aria-label="Field" value={value} onChange={(e) => { setValue(e.target.value); onChange?.(e.target.value) }} {...props} />
}

describe('text fields', () => {
  it('show a × once there is text, and it empties the field', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const field = screen.getByRole('textbox', { name: 'Field' })
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()

    await userEvent.type(field, 'ubuntu')
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(field).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(field).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('empty a field that only has a starting value', async () => {
    render(<Input aria-label="Path" defaultValue="/downloads" />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Path' })).toHaveValue('')
  })

  it('leave number and password fields without a ×', () => {
    render(
      <>
        <Input aria-label="Count" type="number" defaultValue="3" />
        <Input aria-label="Password" type="password" defaultValue="secret" />
      </>,
    )
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('give no × to a field that is turned off', () => {
    render(<Input aria-label="Locked" defaultValue="x" disabled />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('give text boxes a × too', async () => {
    render(<Textarea aria-label="Trackers" defaultValue="udp://a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Trackers' })).toHaveValue('')
  })
})

describe('a field that needs an entry', () => {
  it('shows a small note instead of sending the form, and drops it once typed in', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Controlled required />
        <button type="submit">Go</button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in this field')
    expect(screen.getByRole('textbox', { name: 'Field' })).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(screen.getByRole('textbox', { name: 'Field' }), 'a')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('drops the note when the field loses focus', async () => {
    render(<form><Controlled required /></form>)
    const field = screen.getByRole('textbox', { name: 'Field' })
    fireEvent.invalid(field)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.blur(field)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
