interface ProjectOptions {
    projectName: string;
    targetDir: string;
    mode: 'minimal' | 'svelte' | 'vue';
    features: string[];
}
export declare function setupProject(options: ProjectOptions): Promise<void>;
export {};
