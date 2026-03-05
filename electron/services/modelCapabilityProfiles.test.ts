import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildModelCapabilityProfilePrompt,
  resolveModelCapabilityProfile,
} from './modelCapabilityProfiles'

test('metadata-first: reasoning models resolve from metadata (not name buckets)', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'any-new-model-name',
    modelsDevMetadata: {
      reasoning: true,
      toolCall: true,
    },
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.profileId, 'metadata-reasoning-model')
  assert.equal(profile.toolUseGuidance, 'normal')
  assert.equal(profile.reminderAggressiveness, 'normal')
  assert.equal(profile.maxRetries, 2)
  assert.equal(profile.delegationStyle, 'balanced')
})

test('metadata-first: non-tool-call models resolve from metadata', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'text-only-model',
    modelsDevMetadata: {
      reasoning: false,
      toolCall: false,
    },
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.profileId, 'metadata-no-tool-call')
  assert.equal(profile.toolUseGuidance, 'normal')
  assert.equal(profile.reminderAggressiveness, 'normal')
  assert.equal(profile.maxRetries, 2)
  assert.equal(profile.delegationStyle, 'balanced')
})

test('fallback default remains neutral when metadata is unavailable', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'openrouter',
    modelId: 'minimax-m2.5-highspeed',
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.profileId, 'balanced-fallback')
  assert.equal(profile.toolUseGuidance, 'normal')
  assert.equal(profile.reminderAggressiveness, 'normal')
  assert.equal(profile.maxRetries, 2)
  assert.equal(profile.delegationStyle, 'balanced')
})

test('local providers still receive local defaults', () => {
  const profile = resolveModelCapabilityProfile({
    providerType: 'ollama',
    modelId: 'llama3',
  })

  assert.equal(profile.source, 'default')
  assert.equal(profile.profileId, 'local-model')
  assert.equal(profile.toolUseGuidance, 'high')
  assert.equal(profile.reminderAggressiveness, 'high')
  assert.equal(profile.maxRetries, 3)
  assert.equal(profile.delegationStyle, 'parallel-first')
})

test('provider overrides apply for exact model ids and wildcard values', () => {
  const profileExact = resolveModelCapabilityProfile({
    providerType: 'openai',
    modelId: 'gpt-4o-mini',
    modelsDevMetadata: {
      reasoning: true,
      toolCall: true,
    },
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
    modelsDevMetadata: {
      reasoning: true,
      toolCall: true,
    },
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
