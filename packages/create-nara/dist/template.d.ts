interface ProjectOptions {
    projectName: string;
    targetDir: string;
}
export declare function setupProject(options: ProjectOptions): Promise<void>;
export {};
