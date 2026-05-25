#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const claudeDir = path.join(os.homedir(), '.claude')
const settingsPath = path.join(claudeDir, 'settings.json')
const statusPath = path.join(claudeDir, 'pet-status.json')

// Ensure ~/.claude exists
fs.mkdirSync(claudeDir, { recursive: true })

// Write initial status file so the pet has something to watch
fs.writeFileSync(statusPath, JSON.stringify({ status: 'idle' }))

// Load existing settings without clobbering them
let settings = {}
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
} catch (e) {
  // No settings file yet — start fresh
}

// Hook commands write a simple JSON status file that the pet watches
const write = (status) =>
  `printf '{"status":"${status}"}' > ~/.claude/pet-status.json`

settings.hooks = {
  // Tool starting → building animation
  PreToolUse: [{ hooks: [{ type: 'command', command: write('running') }] }],

  // Tool finished → thinking animation (Claude is processing the result)
  PostToolUse: [{ hooks: [{ type: 'command', command: write('thinking') }] }],

  // Claude's full response is done → happy animation
  Stop: [{ hooks: [{ type: 'command', command: write('done') }] }],

  // Claude is waiting for your input → thinking animation
  Notification: [{ hooks: [{ type: 'command', command: write('waiting') }] }],
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

console.log('Clawd hooks configured!')
console.log('')
console.log('  Settings file :', settingsPath)
console.log('  Status file   :', statusPath)
console.log('')
console.log('Clawd will now react to Claude Code activity:')
console.log('  Tool running   ->  building animation')
console.log('  Tool done      ->  thinking animation')
console.log('  Response done  ->  happy animation')
console.log('  Waiting for you ->  thinking animation')
console.log('')
console.log('Make sure Claude Code Pet.app is running, then start a Claude Code session!')
