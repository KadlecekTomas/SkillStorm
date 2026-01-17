import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function DemoTestPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-secondary px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Interactive preview</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Climate & ecosystems knowledge check
            </h1>
          </div>
          <Progress value={40} />
          <div className="space-y-3 text-slate-700">
            <p className="font-semibold">Question 3</p>
            <p>
              Which of the following contributes the most to a stable ecosystem?
            </p>
            <div className="space-y-2">
              {["Biodiversity", "Average rainfall", "Population size"].map((option) => (
                <Button key={option} variant="outline" className="w-full justify-start">
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
