import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useDecisionPromptStore, type DecisionPromptRequest } from './decisionPrompt'

function createRequest(title: string, defaultValue = 'cancel'): DecisionPromptRequest {
  return {
    title,
    message: `${title} message`,
    options: [
      { label: 'Confirm', value: 'confirm', variant: 'primary' },
      { label: 'Cancel', value: 'cancel', variant: 'secondary' },
    ],
    defaultValue,
    cancelValue: 'cancel',
  }
}

beforeEach(() => {
  useDecisionPromptStore.setState({
    activeRequest: null,
    activeResolve: null,
    queuedRequests: [],
  })
})

test('decision prompt requests queue instead of canceling an active dialog', async () => {
  const firstPromise = useDecisionPromptStore.getState().request(createRequest('First prompt'))
  const secondPromise = useDecisionPromptStore.getState().request(createRequest('Second prompt'))

  let firstResolved = false
  void firstPromise.then(() => {
    firstResolved = true
  })
  await Promise.resolve()

  assert.equal(firstResolved, false)
  assert.equal(useDecisionPromptStore.getState().activeRequest?.title, 'First prompt')
  assert.equal(useDecisionPromptStore.getState().queuedRequests.length, 1)

  useDecisionPromptStore.getState().choose('confirm')
  assert.deepEqual(await firstPromise, { value: 'confirm', canceled: false })
  assert.equal(useDecisionPromptStore.getState().activeRequest?.title, 'Second prompt')
  assert.equal(useDecisionPromptStore.getState().queuedRequests.length, 0)

  useDecisionPromptStore.getState().cancel()
  assert.deepEqual(await secondPromise, { value: 'cancel', canceled: true })
  assert.equal(useDecisionPromptStore.getState().activeRequest, null)
})
