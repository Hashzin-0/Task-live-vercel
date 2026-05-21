class FunctionCallDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  requiredParameters?: string[]

  constructor(name: string, description: string, parameters: Record<string, any>, requiredParameters?: string[]) {
    this.name = name
    this.description = description
    this.parameters = parameters
    this.requiredParameters = requiredParameters
  }

  functionToCall(_parameters: Record<string, any>): any {
    console.log("Default function call")
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: { required: this.requiredParameters, ...this.parameters },
    }
  }

  runFunction(parameters: Record<string, any>) {
    return this.functionToCall(parameters)
  }
}

export class ShowAlertTool extends FunctionCallDefinition {
  constructor() {
    super(
      "show_alert",
      "Displays an alert dialog to the user with a custom message.",
      {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The message to display in the alert dialog.",
          },
        },
      },
      ["message"]
    )
  }

  functionToCall(parameters: Record<string, any>) {
    alert(parameters.message)
    return "Alert displayed"
  }
}

export class AddCSSStyleTool extends FunctionCallDefinition {
  constructor() {
    super(
      "add_css_style",
      "Injects a CSS style rule into the page.",
      {
        type: "object",
        properties: {
          css: {
            type: "string",
            description: "The CSS rule to inject, e.g. 'body { background: red; }'",
          },
        },
      },
      ["css"]
    )
  }

  functionToCall(parameters: Record<string, any>) {
    const style = document.createElement("style")
    style.textContent = parameters.css
    document.head.appendChild(style)
    return "Style applied: " + parameters.css
  }
}
