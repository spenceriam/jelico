import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildModelCapabilityProfilePrompt,
  resolveModelCapabilityProfile,
} from './modelCapabilityProfiles'

test('small models resolve to higher guidance and retry defaults', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'gpt-4o-mini',
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.toolUseGuidance, 'high')
  assert.equal(profile.reminderAggressiveness, 'high')
  assert.equal(profile.maxRetries, 3)
  assert.equal(profile.delegationStyle, 'parallel-first')
})

test('reasoning models resolve to conservative retry/delegation defaults', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'o3',
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.toolUseGuidance, 'low')
  assert.equal(profile.reminderAggressiveness, 'low')
  assert.equal(profile.maxRetries, 1)
  assert.equal(profile.delegationStyle, 'minimal')
})

test('provider overrides apply for exact model ids and wildcard values', () => {
  const profileExact = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'gpt-4o-mini',
    providerOverrides: {
      'gpt-4o-mini': {
        maxRetries: 6,
        delegationStyle: 'minimal',
      },
    },
  })

  assert.equal(profileExact.source, 'provider_override')
  assert.equal(profileExact.maxRetries, 6)
  assert.equal(profileExact.delegationStyle, 'minimal')

  const profileWildcard = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'gpt-4.1',
    providerOverrides: {
      '*': {
        reminderAggressiveness: 'high',
      },
    },
  })

  assert.equal(profileWildcard.source, 'provider_override')
  assert.equal(profileWildcard.reminderAggressiveness, 'high')
})

test('prompt formatter includes profile metadata for runtime diagnostics', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'gpt-4o',
  })
  const prompt = buildModelCapabilityProfilePrompt(profile)

  assert.match(prompt, /Active Model Capability Profile/)
  assert.match(prompt, /Retry policy: max/)
  assert.match(prompt, new RegExp(`Delegation style: ${profile.delegationStyle}`))
})

