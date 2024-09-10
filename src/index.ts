import { Probot } from "probot"
import { Anthropic } from "@anthropic-ai/sdk"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function getRefactorSuggestions(diff: string): Promise<string> {
  try {
    const completion = await client.messages.create({
      system: "You are a helpful assistant that suggests code refactors.",
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Please suggest refactors for the following code diff:\n\n${diff}`,
        },
      ],
    })

    if (!completion.content || !Array.isArray(completion.content)) {
      throw new Error("Unexpected response structure from Claude API")
    }

    const refactorSuggestions = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n")

    if (!refactorSuggestions) {
      throw new Error("No text content found in Claude's response")
    }

    return refactorSuggestions
  } catch (error) {
    console.error("Error in getRefactorSuggestions:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    throw error
  }
}

export default (app: Probot) => {
  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request

    const loadingComment = await context.octokit.issues.createComment({
      owner: context.repo().owner,
      repo: context.repo().repo,
      issue_number: pr.number,
      body: "⏳ Analyzing pull request and generating refactoring suggestions... Please wait.",
    })

    try {
      // Get the list of files changed in the pull request
      const { data: files } = await context.octokit.pulls.listFiles({
        owner: context.repo().owner,
        repo: context.repo().repo,
        pull_number: pr.number,
      })

      for (const file of files) {
        // Get the file content
        const { data: fileContent } = await context.octokit.repos.getContent({
          owner: context.repo().owner,
          repo: context.repo().repo,
          path: file.filename,
          ref: pr.head.sha,
        })

        // Ensure fileContent is of type { content: string }
        if (
          "content" in fileContent &&
          typeof fileContent.content === "string"
        ) {
          const decodedContent = Buffer.from(
            fileContent.content,
            "base64"
          ).toString("utf8")

          const fileDiff = `File: ${file.filename}\n\n${decodedContent}`
          const refactorSuggestions = await getRefactorSuggestions(fileDiff)

          await context.octokit.pulls.createReviewComment({
            owner: context.repo().owner,
            repo: context.repo().repo,
            pull_number: pr.number,
            body: `Refactoring suggestions for ${file.filename}:\n\n${refactorSuggestions}`,
            commit_id: pr.head.sha,
            path: file.filename,
            position: file.changes,
          })

          app.log.info(`Posted review comment for ${file.filename}`)
        } else {
          app.log.warn(`Unable to get content for ${file.filename}`)
        }
      }

      // Post a general comment to indicate that refactoring suggestions have been added
      await context.octokit.issues.updateComment({
        owner: context.repo().owner,
        repo: context.repo().repo,
        comment_id: loadingComment.data.id,
        body: "✅ Refactoring suggestions have been added as review comments on individual file changes.",
      })
    } catch (error) {
      app.log.error("Error in pull request processing:", error)

      if (loadingComment) {
        await context.octokit.issues.updateComment({
          owner: context.repo().owner,
          repo: context.repo().repo,
          comment_id: loadingComment.data.id,
          body: "❌ An error occurred while generating refactor suggestions. Please check the logs for more details.",
        })
      } else {
        await context.octokit.issues.createComment({
          owner: context.repo().owner,
          repo: context.repo().repo,
          issue_number: pr.number,
          body: "❌ An error occurred while generating refactor suggestions. Please check the logs for more details.",
        })
      }
    }
  })
}
