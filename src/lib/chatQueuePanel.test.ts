import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNextProcessableQueuedMessageIndex,
  getPersistableQueuedMessages,
  promoteQueuedMessageToFront,
  getQueuePanelAnchor,
  getQueuePanelExpandedByConversation,
  getQueuePanelConversationKey,
  getQueuedCountForConversation,
  getQueuedMessagePreview,
  getVisibleQueuedMessages,
  insertQueuedMessageAtAnchor,
  mergeHydratedQueuedMessages,
} from './chatQueuePanel'

test('maps missing conversation ids to the shared new-chat queue key', () => {
  assert.equal(getQueuePanelConversationKey(null), '__new__')
  assert.equal(getQueuePanelConversationKey(undefined), '__new__')
})

test('keeps explicit conversation ids as distinct queue keys', () => {
  assert.equal(getQueuePanelConversationKey('conv-1'), 'conv-1')
})

test('counts queued entries for a matching active conversation', () => {
  const queuedCount = getQueuedCountForConversation(
    [
      { conversationId: 'conv-1' },
      { conversationId: 'conv-2' },
      { conversationId: 'conv-1' },
    ],
    'conv-1'
  )

  assert.equal(queuedCount, 2)
})

test('counts null-conversation entries against the new-chat queue key', () => {
  const queuedCount = getQueuedCountForConversation(
    [
      { conversationId: null },
      {},
      { conversationId: 'conv-1' },
    ],
    null
  )

  assert.equal(queuedCount, 2)
})

test('marks each conversation with queued items as expanded when hydrating from persistence', () => {
  const expandedByConversation = getQueuePanelExpandedByConversation([
    { conversationId: 'conv-1' },
    { conversationId: null },
    { conversationId: 'conv-2' },
    { conversationId: 'conv-1' },
  ])

  assert.deepEqual(expandedByConversation, {
    'conv-1': true,
    '__new__': true,
    'conv-2': true,
  })
})

test('keeps queued text content as the primary preview and adds a single pasted attachment summary', () => {
  const preview = getQueuedMessagePreview({
    content: 'This is a long queued message that should wrap in the UI.',
    attachments: [{ name: 'Pasted ~87 lines' }],
  })

  assert.deepEqual(preview, {
    primaryText: 'This is a long queued message that should wrap in the UI.',
    secondaryText: '+ Pasted ~87 lines',
  })
})

test('surfaces pasted attachment names when a queued message has no text content', () => {
  const preview = getQueuedMessagePreview({
    content: '',
    attachments: [{ name: 'Pasted ~121 lines' }],
  })

  assert.deepEqual(preview, {
    primaryText: 'Pasted ~121 lines',
    secondaryText: null,
  })
})

test('falls back to a generic attachment count for multi-attachment queued messages', () => {
  const preview = getQueuedMessagePreview({
    attachments: [{ name: 'first.txt' }, { name: 'second.png' }],
  })

  assert.deepEqual(preview, {
    primaryText: '2 attachments',
    secondaryText: null,
  })
})

test('captures the immediate previous and next queued ids in full queue order', () => {
  const anchor = getQueuePanelAnchor(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
      { id: 'c', conversationId: 'conv-1' },
      { id: 'd', conversationId: 'conv-1' },
    ],
    'c'
  )

  assert.deepEqual(anchor, {
    previousId: 'b',
    nextId: 'd',
  })
})

test('re-inserts an edited queued message before its original next sibling when available', () => {
  const reordered = insertQueuedMessageAtAnchor(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'd', conversationId: 'conv-1' },
    ],
    { id: 'c', conversationId: 'conv-1' },
    { previousId: 'a', nextId: 'd' }
  )

  assert.deepEqual(reordered.map((message) => message.id), ['a', 'c', 'd'])
})

test('promotes a queued message to the front without changing the rest of the order', () => {
  const reordered = promoteQueuedMessageToFront(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
      { id: 'c', conversationId: 'conv-1' },
    ],
    'c'
  )

  assert.deepEqual(reordered.map((message) => message.id), ['c', 'a', 'b'])
})

test('re-inserts an edited queued message after its original previous sibling when the next one is gone', () => {
  const reordered = insertQueuedMessageAtAnchor(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'x', conversationId: 'conv-2' },
    ],
    { id: 'c', conversationId: 'conv-1' },
    { previousId: 'a', nextId: 'd' }
  )

  assert.deepEqual(reordered.map((message) => message.id), ['a', 'c', 'x'])
})

test('restores an edited queued message without reordering other conversations', () => {
  const reordered = insertQueuedMessageAtAnchor(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
    ],
    { id: 'c', conversationId: 'conv-1' },
    { previousId: 'b', nextId: null }
  )

  assert.deepEqual(reordered.map((message) => message.id), ['a', 'b', 'c'])
})

test('finds the first queued message whose conversation is not blocked', () => {
  const nextIndex = getNextProcessableQueuedMessageIndex(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
      { id: 'c', conversationId: null },
    ],
    new Set(['conv-1'])
  )

  assert.equal(nextIndex, 1)
})

test('treats new-chat queued entries as immediately processable', () => {
  const nextIndex = getNextProcessableQueuedMessageIndex(
    [
      { id: 'a', conversationId: null },
      { id: 'b', conversationId: 'conv-2' },
    ],
    new Set(['conv-2'])
  )

  assert.equal(nextIndex, 0)
})

test('merges hydrated queued messages with newer in-memory additions', () => {
  const merged = mergeHydratedQueuedMessages(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
    ],
    [
      { id: 'b', conversationId: 'conv-2' },
      { id: 'c', conversationId: 'conv-1' },
    ]
  )

  assert.deepEqual(merged.map((message) => message.id), ['a', 'b', 'c'])
})

test('drops explicitly deleted queued ids while merging hydrated queue state', () => {
  const merged = mergeHydratedQueuedMessages(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-2' },
    ],
    [],
    ['a']
  )

  assert.deepEqual(merged.map((message) => message.id), ['b'])
})

test('keeps a hidden queued edit in the persisted queue output', () => {
  const persistableQueue = getPersistableQueuedMessages(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'c', conversationId: 'conv-1' },
    ],
    {
      queuedMessage: { id: 'b', conversationId: 'conv-1' },
      anchor: { previousId: 'a', nextId: 'c' },
    }
  )

  assert.deepEqual(persistableQueue.map((message) => message.id), ['a', 'b', 'c'])
})

test('excludes a hidden queued edit from the visible queue output', () => {
  const visibleQueue = getVisibleQueuedMessages(
    [
      { id: 'a', conversationId: 'conv-1' },
      { id: 'b', conversationId: 'conv-1' },
      { id: 'c', conversationId: 'conv-1' },
    ],
    {
      queuedMessage: { id: 'b', conversationId: 'conv-1' },
      anchor: { previousId: 'a', nextId: 'c' },
    }
  )

  assert.deepEqual(visibleQueue.map((message) => message.id), ['a', 'c'])
})
