import fs from 'fs'
import {platform} from 'os'
import * as core from '@actions/core'
import axios, {isAxiosError} from 'axios'
import {BaseContext, Cli} from 'clipanion'
import {DsymsUploadCommand} from '@datadog/datadog-ci-base/commands/dsyms/upload'

async function validateSubscription() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  let repoPrivate: boolean | undefined

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    repoPrivate = eventData?.repository?.private
  }

  const upstream = 'datadog/upload-dsyms-github-action'
  const action = process.env.GITHUB_ACTION_REPOSITORY
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions'

  core.info('')
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m')
  core.info(`Secure drop-in replacement for ${upstream}`)
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m')
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`)
  core.info('')

  if (repoPrivate === false) return

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
  const body: Record<string, string> = {action: action || ''}
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      {timeout: 3000}
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`)
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`)
      process.exit(1)
    }
    core.info('Timeout or API not reachable. Continuing to next step.')
  }
}

// Create a local clipanion cli and register the dsyms DsymsUploadCommand.
export const cli = new Cli()
cli.register(DsymsUploadCommand)

/**
 * Uploads Dsym files at the given path.
 *
 * @param path The path to the dsym files
 * @param dry_run If set to `true`, it will run the command without the
 *                final step of upload. All other checks are performed.
 * @param context The cli command context.
 * @returns 0 for success, 1 for failure.
 */
export const upload = async (path: string, dry_run: boolean, context: BaseContext): Promise<number> => {
  const cmd = ['dsyms', 'upload', path]
  if (dry_run) cmd.push('--dry-run')
  return cli.run(cmd, context)
}

export const main = async (): Promise<void> => {
  await validateSubscription()
  try {
    if (platform() !== 'darwin') {
      throw new Error('This Action runs on macOS only.')
    }

    process.env.DATADOG_API_KEY = core.getInput('api_key', {required: true})
    process.env.DATADOG_SITE = core.getInput('site')

    const context: BaseContext = {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
      colorDepth: 1,
    }

    const paths = core.getMultilineInput('dsym_paths', {required: true})
    // https://github.com/actions/toolkit/issues/844
    // Can't use core.getBooleanInput() because it breaks when input is not set.
    const dry_run = core.getInput('dry_run', {required: false}).toLowerCase() === 'true'

    for (const path of paths) {
      await upload(path, dry_run, context)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

if (require.main === module) {
  main()
}
