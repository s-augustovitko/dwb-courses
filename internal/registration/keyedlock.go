package registration

import "sync"

type keyedLock struct {
	mu      sync.Mutex
	entries map[string]*lockEntry
}

type lockEntry struct {
	mu    sync.Mutex
	users int
}

// lock blocks until the key is free and returns the function that releases it;
// unused entries are dropped.
func (k *keyedLock) lock(key string) func() {
	k.mu.Lock()

	entry, found := k.entries[key]
	if !found {
		entry = &lockEntry{mu: sync.Mutex{}, users: 0}
		k.entries[key] = entry
	}

	entry.users++
	k.mu.Unlock()

	entry.mu.Lock()

	return func() {
		entry.mu.Unlock()

		k.mu.Lock()
		defer k.mu.Unlock()

		entry.users--
		if entry.users == 0 {
			delete(k.entries, key)
		}
	}
}
