# React Monorepos: Ionic and Lerna and Rollup, oh my!

Building and maintaining multiple development projects comes with a unique set of problems teams need to solve. How do you share common bits of code between projects? How do you sync dependencies across projects? How do you optimize collaboration between projects?

With solutions to those problems, it's not shocking to see that monorepos are rapidly growing in popularity. In fact, we use monorepos here at Ionic! Several monorepo tools are available to development teams: Nx, Yarn workspaces, npm workspaces, Lerna, Turborepo...and I'm sure more that I'm not even aware of.

In this blog post we'll be building out a monorepo using [Lerna](https://lerna.js.org/). I personally like how lightweight it is, and it works well with Ionic Framework React projects and Ionic Appflow.

Our monorepo will consist of three packages (monorepo speak for subprojects); two Ionic Framework React applications, and a shared React library that will supply a React context each application will use.

## Initializing a Lerna Repository

Before we start generating Ionic Framework applications or building the shared code library, we need to initialize a Lerna repository. This space will hold all of our packages and is committed to source control as one repository.

```bash
$ npm install -g lerna
$ git init my-organization && cd my-organization
$ lerna init
```

Crack open the generated `lerna.json` file. By default, Lerna declares that all of your monorepos packages will be housed in the `packages/` folder. We can modify what folder(s) house our packages -- let's create a folder to house our Ionic Framework React applications, and another to house our shared React libraries.

```bash
$ rmdir packages
$ mkdir apps
$ mkdir shared
```

Update `lerna.json` so we can relay our monorepo's structure to Lerna:

```json
{
  "packages": ["apps/*", "shared/*"],
  "version": "0.0.0"
}
```

Before we add any packages to our monorepo, let's make sure to use the Ionic CLI to establish a multi-app setup:

```bash
$ ionic init --multi-app
```

## Generating multiple Ionic Framework React applications

The initial plumbing of our monorepo is set up, now it's time to create our Ionic Framework React applications. To ensure they are created in our `apps/` folder, we're going to `cd` into it then generate our apps.

```bash
$ cd apps/
$ ionic start customers blank --type=react
$ ionic start employees blank --type=react --no-deps
```

Remember that one challenge monorepos solve is the ability to manage dependencies across projects? We can use a technique known as "dependency hoisting" to have both packages point to the same folders containing the dependencies.

```bash
$ cd ../
$ lerna bootstrap --hoist
```

This process moved dependencies shared across packages into a `node_modules` folder at the root of the repository. Lerna creates symlinks for the packages to reference when a shared dependency is required.

Lerna doesn't initialize a `.gitignore` at the root of the repository. It's not a good idea to commit all the hoisted dependencies, so let's create one to exclude our dependencies from being committed to source control.

```bash
$ echo "node_modules" > .gitignore
```

> **Note:** To run a package's npm commands using the Lerna CLI, the command is `lerna run <script> --scope=<package>`. As an example, to serve the Employees app run `lerna run start --scope=employees`.

## Creating a shared code library

Tools like Storybook and Bit are out there that provide CLIs that generate React libraries intended to be shared. They might be great tools for you to add to your development toolbox, but I find them to have too much overhead. For the purpose of this blog post, we'll use [Rollup](https://rollupjs.org/guide/en/) to build our own.

### Structuring the package

Lerna allows us to create generic JavaScript projects through it's CLI. Let's add a package and structure it such that it can be used as a reusable React library.

```bash
$ lerna create @myorg/core shared --description="Core shared library" --es-module --access=restricted --yes
```

Let's add Rollup to the package and make some modifications to the package structure.

```bash
$ cd shared/core
$ npm install --save-dev rollup rollup-plugin-typescript2
$ echo "dist" >> .gitignore
$ rm -rf __tests__ README.md
$ mv src/core.js src/index.ts
$ touch rollup.config.js tsconfig.json
$ cd ../../
```

Next, populate `shared/code/rollup.config.js` with the following code:

```JavaScript
import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';

const input = "src/index.ts";

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const plugins = [ typescript({ typescript: require("typescript") }) ];

export default [
  {
    input,
    output: { file: pkg.module, format: "esm", sourcemap: true },
    plugins,
    external
  },
  {
    input,
    output: { file: pkg.main, format: "cjs", sourcemap: true },
    plugins,
    external
  },
];
```

Then populate `shared/core/tsconfig.json` with the following code:

```JSON
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "allowUnreachableCode": false,
    "declaration": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "importHelpers": true,
    "lib": ["es2015", "dom"],
    "module": "es2015",
    "moduleResolution": "node",
    "noEmitHelpers": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "es2017",
    "sourceMap": true,
    "inlineSources": true,
    "jsx": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/**.test.*"]
}
```

Finally, we need to make some modifications to `shared/core/package.json`.

1. Add a new section named `peerDependencies`. Copy over the `dependencies` array from one of the apps and paste it in this section.
2. Add the array of `peerDependencies` to the array of `devDependencies`.
3. Remove the `files` section.
4. In the `directories` section, change the `lib` value to `src` and remove the `test` entry.
5. Update the `main` property to `dist/index.js` and `module` to `dist/index.esm.js`.
6. Replace the contents of the `scripts` section with the following scripts:
   ```JSON
   "build": "npx rollup -c",
   "watch": "npx rollup -c -w"
   ```

> **Note:** Not all `peerDependencies` or `devDependencies` are needed. You can prune any that aren't being used in the package's source code.

Now we can add our shared package to our applications.

```bash
$ lerna run build --scope=@myorg/core
$ lerna bootstrap --hoist
$ lerna add @myorg/core
```

When adding a shared package to application packages in a monorepo, use the scoped npm package naming approach (such as `@myorg/core`). Not only does it remove the need to do any kind of path-mapping, it's also super cool!

### Building a theme context

_Technically_ we can demo the shared library in our application packages by importing the `core()` function defined in `@myorg/core` but that's pretty lame. Instead, let's build a React Context that provides the plumbing needed to allow users to toggle light/dark mode on the applications.

```bash
$ echo "export * from './theme/ThemeContext';" > shared/core/src/index.ts
$ mkdir shared/core/src/theme
$ touch shared/core/src/theme/ThemeContext.tsx
```

Populate `shared/core/src/theme/ThemeContext.tsx` with the following code:

```TSX
import React, { createContext, useContext, useEffect, useState } from "react";

const initialContext = {
  isDarkMode: false,
  toggleDarkMode: (_: boolean) => {},
};

const ThemeContext = createContext(initialContext);
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC = ({ children }) => {
  const [isDarkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    prefersDark.addEventListener("change", (e) => setDarkMode(e.matches));
    toggleDarkMode(prefersDark.matches);
  }, []);

  const toggleDarkMode = (useDarkMode: boolean) => {
    document.body.classList.toggle("dark", useDarkMode);
    setDarkMode(useDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

Rebuild the `@myorg/core` package so the applications can have access to `<ThemeProvider />` and `useTheme()`.

```bash
$ lerna run build --scope=@myorg/core
```

> **Note:** While developing shared libraries, it's beneficial to run `lerna run watch --scope=<package>` to rebuild the library in real-time.

### Putting it all together

Let's update our application packages to see our theme context in action. The following actions should be performed in both the `customers` and `employees` packages:

1. Remove the `@media (prefers-color-scheme: dark)` media query in `variables.css`.
2. In `variables.css`, append `.dark` to any `body` selector; `body` becomes `body.dark`, `.ios body` becomes `.ios body.dark`, and `.md body` becomes `.md body.dark`.
3. In `App.tsx` add the following import: `import { ThemeProvider } from '@myorg/core';`
4. In `App.tsx`, wrap the `<IonApp>` component and it's children with `<ThemeProvider>`, so `<ThemeProvider>` is the outer-most component of the `App` template.

Serve one of the applications (`lerna run start --scope=<package>`), change your dark mode preference, and refresh the browser to test it out!

## Integrating with Appflow

[Appflow](https://ionic.io/appflow) is Ionic's mobile CI/CD platform that makes it easy to build, publish, and update your apps over time. Oh, and it also supports monorepos!

To support a monorepo structure, Appflow needs a singular `appflow.config.json` file at the root of the monorepo repository.

```bash
$ touch appflow.config.json
```

Populate the file with the following:

```JSON
{
  "apps": [
    {
      "appId": "XXXXXXXX",
      "root": "apps/customers",
      "dependencyInstallCommand": "cd ../../ && npx lerna bootstrap && npx lerna run build --scope=@myorg/core"

    },
    {
      "appId": "XXXXXXX",
      "root": "apps/employees",
      "dependencyInstallCommand": "cd ../../ && npx lerna bootstrap && npx lerna run build --scope=@myorg/core"

    }
  ]
}
```

Replace the `appId` values with the ones provided to you from Appflow, of course. The important bit here is that as part of the dependency install command we build the shared packages after bootstrapping Lerna. In a real-world scenario you'd probably want to create a custom shell script to encapsulate the commands used above -- especially as the amount of shared libraries in your monorepo scale.

## Wrapping up

We now have a monorepo built with Lerna that contains two Ionic Framework React applications and a shared React library, hooked up to Appflow for continuous integration and continuous deployment!

Our monorepo solves several problems encountered when maintaining multiple projects: it shares common code between projects, manages dependencies across projects, and eases collaboration effort between projects.

With a solid foundation in place you can continue scaling your monorepo to fit you and your development team's needs.
