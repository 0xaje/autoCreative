#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const ProductionPipeline = require('./src/agents/pipeline');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    githubUrl: null,
    liveUrl: null,
    localPath: null,
    prompt: 'Create a 60-second professional product launch video showcasing real features and verified performance.',
    mode: 'launch',
    duration: 60,
    aspectRatio: '16:9',
    voiceId: 'en-US-ChristopherNeural',
    musicStyle: 'cinematic',
    isDemo: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--github' || arg === '-g') options.githubUrl = args[++i];
    else if (arg === '--live' || arg === '-l') options.liveUrl = args[++i];
    else if (arg === '--local') options.localPath = args[++i];
    else if (arg === '--demo') {
      options.isDemo = true;
      options.localPath = path.resolve(__dirname, 'demo-apps/saas-analytics');
    }
    else if (arg === '--prompt' || arg === '-p') options.prompt = args[++i];
    else if (arg === '--mode' || arg === '-m') options.mode = args[++i];
    else if (arg === '--duration' || arg === '-d') options.duration = parseInt(args[++i], 10);
    else if (arg === '--aspect' || arg === '-a') options.aspectRatio = args[++i];
    else if (arg === '--voice' || arg === '-v') options.voiceId = args[++i];
    else if (arg === '--music') options.musicStyle = args[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Autonomous Creative Production Agent CLI

Usage:
  node cli.js [options]

Options:
  --github, -g <url>     GitHub repository URL
  --live, -l <url>       Live application URL
  --local <path>         Local directory or HTML file
  --demo                 Explicitly run with built-in PulseFlow SaaS demo
  --prompt, -p <text>    Natural-language creative video request
  --mode, -m <mode>      Creative mode (launch, demo, presentation, explainer, tutorial, social_short)
  --duration, -d <secs>  Target video duration in seconds (e.g. 60, 90, 30)
  --aspect, -a <ratio>   Aspect ratio (16:9 or 9:16)
  --voice, -v <voice>    Voice model ID (e.g. en-US-ChristopherNeural, en-US-JennyNeural)
  --music <style>        Background music style (cinematic, upbeat)
  --help, -h             Show this help message

Example:
  node cli.js --live "http://localhost:4500/demo-apps/saas-analytics/index.html" \\
              --prompt "Create a 60-second product launch video demonstrating real features" \\
              --mode launch
      `);
      process.exit(0);
    }
  }

  // If no source provided, default to bundled SaaS demo application in explicit DEMO mode
  if (!options.githubUrl && !options.liveUrl && !options.localPath) {
    options.localPath = path.resolve(__dirname, 'demo-apps/saas-analytics');
    options.isDemo = true;
    console.log('💡 No source specified. Explicitly using built-in PulseFlow SaaS demonstration app (sourceMode: DEMO).');
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('\n===============================================================');
  console.log('🎬  AUTONOMOUS CREATIVE PRODUCTION STUDIO');
  console.log('===============================================================');
  console.log(` Mode:        ${options.mode.toUpperCase()}`);
  console.log(` Target Time: ${options.duration}s (${options.aspectRatio})`);
  console.log(` Voice:       ${options.voiceId}`);
  console.log(` Prompt:      "${options.prompt}"`);
  console.log('---------------------------------------------------------------\n');

  const pipeline = new ProductionPipeline();

  let lastPct = 0;
  pipeline.on('progress', ({ agent, message, percent }) => {
    const barLen = 20;
    const filled = Math.round((percent / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    process.stdout.write(`\r[${bar}] ${percent.toString().padStart(3)}% | [${agent}] ${message.slice(0, 75).padEnd(75)}`);
    lastPct = percent;
  });

  try {
    const result = await pipeline.runPipeline({
      projectId: `cli_${Date.now()}`,
      githubUrl: options.githubUrl,
      liveUrl: options.liveUrl,
      localPath: options.localPath,
      prompt: options.prompt,
      mode: options.mode,
      duration: options.duration,
      aspectRatio: options.aspectRatio,
      voiceId: options.voiceId,
      musicStyle: options.musicStyle,
      isDemo: options.isDemo
    });

    console.log('\n\n===============================================================');
    console.log('✅  PRODUCTION COMPLETE — BROADCAST MP4 READY');
    console.log('===============================================================');
    console.log(` 📹 File:          ${result.finalVideo.path}`);
    console.log(` ⏱️  Duration:      ${result.finalVideo.duration.toFixed(1)} seconds`);
    console.log(` 📐 Resolution:    ${result.finalVideo.width}x${result.finalVideo.height}`);
    console.log(` 📦 File Size:     ${(result.finalVideo.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(` 🛡️  QC Score:      ${result.qc?.qualityScore || 100}/100 (${result.qc?.verdict || 'PASS'})`);
    console.log(` 🔍 Evidence:      ${result.evidenceSummary?.verified || 0} claims verified, 0 unverified claims in script`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n\n❌ Production pipeline failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
