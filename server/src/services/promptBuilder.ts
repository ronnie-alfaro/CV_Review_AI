type PromptInput = {
  persona: string;
  task: string;
  context: string;
  instructions: string[];
  constraints: string[];
  outputFormat: string;
  recap: string;
};

export function buildStructuredPrompt(input: PromptInput): string {
  return [
    "<OBJECTIVE_AND_PERSONA>",
    input.persona,
    input.task,
    "</OBJECTIVE_AND_PERSONA>",
    "",
    "<INSTRUCTIONS>",
    ...input.instructions.map((item, index) => `${index + 1}. ${item}`),
    "</INSTRUCTIONS>",
    "",
    "<CONSTRAINTS>",
    ...input.constraints.map((item, index) => `${index + 1}. ${item}`),
    "</CONSTRAINTS>",
    "",
    "<CONTEXT>",
    input.context,
    "</CONTEXT>",
    "",
    "<OUTPUT_FORMAT>",
    input.outputFormat,
    "</OUTPUT_FORMAT>",
    "",
    "<RECAP>",
    input.recap,
    "</RECAP>"
  ].join("\n");
}
