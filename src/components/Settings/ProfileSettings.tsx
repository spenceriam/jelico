import { useEffect, useState } from 'react'
import { Check, User } from 'lucide-react'

export function ProfileSettings() {
  const [userName, setUserName] = useState('')
  const [userIntentions, setUserIntentions] = useState('')
  const [userPreferences, setUserPreferences] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      setIsLoadingProfile(true)
      try {
        const [name, intentions, preferences, additional] = await Promise.all([
          window.jelico.soul.getPreference('userName'),
          window.jelico.soul.getPreference('userIntentions'),
          window.jelico.soul.getPreference('userPreferences'),
          window.jelico.soul.getPreference('additionalInfo'),
        ])

        if (name?.value) setUserName(name.value as string)
        if (intentions?.value) setUserIntentions(intentions.value as string)
        if (preferences?.value) setUserPreferences(preferences.value as string)
        if (additional?.value) setAdditionalInfo(additional.value as string)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      await Promise.all([
        window.jelico.soul.setPreference('userName', userName.trim(), 1.0),
        window.jelico.soul.setPreference('userIntentions', userIntentions.trim(), 1.0),
        window.jelico.soul.setPreference('userPreferences', userPreferences.trim(), 1.0),
        window.jelico.soul.setPreference('additionalInfo', additionalInfo.trim(), 1.0),
      ])
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <section className="h-full flex flex-col">
      <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
        <User className="w-5 h-5" />
        Your Profile
      </h3>

      {isLoadingProfile ? (
        <div className="text-text-muted">Loading profile...</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
              placeholder="What should Jelico call you?"
            />
          </div>

          <div className="mt-4 flex-1 min-h-0 grid gap-4 grid-rows-3">
            <div className="min-h-0 flex flex-col">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Your Intentions
              </label>
              <textarea
                value={userIntentions}
                onChange={(e) => setUserIntentions(e.target.value)}
                className="w-full flex-1 min-h-0 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="What are you working on? What brings you here?"
              />
            </div>

            <div className="min-h-0 flex flex-col">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Communication Preferences
              </label>
              <textarea
                value={userPreferences}
                onChange={(e) => setUserPreferences(e.target.value)}
                className="w-full flex-1 min-h-0 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="How do you prefer Jelico to communicate?"
              />
            </div>

            <div className="min-h-0 flex flex-col">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Additional Context
              </label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="w-full flex-1 min-h-0 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="Anything else Jelico should know about you?"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50"
            >
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : isSavingProfile ? (
                'Saving...'
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
