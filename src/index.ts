
import { Probot } from "probot";
import { getClaudeRefactorSuggestions } from "./api.js";

export default (app: Probot) => {
  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request;
    
    // Fetch the pull request diff
    const diffResponse = await context.octokit.pulls.get({
      owner: context.repo().owner,
      repo: context.repo().repo,
      pull_number: pr.number,
      mediaType: {
        format: "diff",
      },
    });

    const diff = diffResponse.data as unknown as string

    try {
      // Get refactor suggestions from Claude via Together AI
      const refactorSuggestions = await getClaudeRefactorSuggestions(diff);

      // Post the suggestions as a comment on the pull request
      await context.octokit.issues.createComment(context.issue({
        body: `Here are some refactoring suggestions:\n\n${refactorSuggestions}`,
      }));
    } catch (error) {
      console.error("Error getting refactor suggestions:", error);
      await context.octokit.issues.createComment(context.issue({
        body: "An error occurred while generating refactor suggestions.",
      }));
    }
  });
};