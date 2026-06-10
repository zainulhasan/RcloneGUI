import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Progress } from "./progress";
import { Switch } from "./switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("design-system primitives", () => {
  it("renders Button with text and handles click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders Button variants without crashing", () => {
    render(
      <>
        <Button variant="default">a</Button>
        <Button variant="destructive">b</Button>
        <Button variant="outline">c</Button>
        <Button variant="secondary">d</Button>
        <Button variant="ghost">e</Button>
      </>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("renders Card structure", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Remote</CardTitle>
          <CardDescription>An S3 bucket</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
      </Card>,
    );
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("An S3 bucket")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("opens Dialog on trigger click", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Confirm delete</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("Confirm delete")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Confirm delete")).toBeInTheDocument();
  });

  it("renders Table rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>movie.mkv</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("movie.mkv")).toBeInTheDocument();
  });

  it("switches Tabs content", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">content-a</TabsContent>
        <TabsContent value="b">content-b</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("content-a")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByText("content-b")).toBeInTheDocument();
  });

  it("renders Input with Label and accepts text", async () => {
    render(
      <>
        <Label htmlFor="path">Path</Label>
        <Input id="path" />
      </>,
    );
    const input = screen.getByLabelText("Path");
    await userEvent.type(input, "remote:/films");
    expect(input).toHaveValue("remote:/films");
  });

  it("renders Badge", () => {
    render(<Badge>watched</Badge>);
    expect(screen.getByText("watched")).toBeInTheDocument();
  });

  it("renders Progress with value", () => {
    render(<Progress value={42} aria-label="transfer progress" />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("toggles Switch", async () => {
    render(<Switch aria-label="dry run" />);
    const sw = screen.getByRole("switch", { name: "dry run" });
    expect(sw).not.toBeChecked();
    await userEvent.click(sw);
    expect(sw).toBeChecked();
  });

  it("renders Alert", () => {
    render(
      <Alert>
        <AlertTitle>Low disk space</AlertTitle>
        <AlertDescription>The file may not fit.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Low disk space")).toBeInTheDocument();
  });
});
