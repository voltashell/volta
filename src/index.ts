// Welcome to your TypeScript project!

interface Greeting {
  message: string;
  timestamp: Date;
}

class Greeter {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  greet(): Greeting {
    return {
      message: `Hello, ${this.name}! Welcome to your TypeScript project.`,
      timestamp: new Date()
    };
  }
}

function main(): void {
  const greeter = new Greeter("Developer");
  const greeting = greeter.greet();
  
  console.log(greeting.message);
  console.log(`Generated at: ${greeting.timestamp.toISOString()}`);
}

// Run the main function
main();
